-- Bandeja transaccional para el modo local. En remoto permanece desactivada.

create table public.offline_runtime (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  device_id uuid not null default gen_random_uuid(),
  local_user_id uuid,
  local_user_email text,
  updated_at timestamptz not null default now()
);

insert into public.offline_runtime (singleton)
values (true)
on conflict (singleton) do nothing;

create table public.offline_change_log (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null,
  table_name text not null,
  operation text not null check (operation in ('INSERT', 'UPDATE', 'DELETE')),
  record_key jsonb not null,
  row_data jsonb,
  actor_user_id uuid,
  changed_at timestamptz not null default now(),
  export_batch_id uuid,
  exported_at timestamptz,
  synced_at timestamptz
);

create index offline_change_log_pending_idx
  on public.offline_change_log (changed_at, id)
  where synced_at is null;

alter table public.offline_runtime enable row level security;
alter table public.offline_change_log enable row level security;

create or replace function public.capture_offline_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  runtime public.offline_runtime%rowtype;
  payload jsonb;
  key_column text := tg_argv[0];
begin
  select * into runtime from public.offline_runtime where singleton = true;
  if not found or not runtime.enabled then
    return coalesce(new, old);
  end if;

  payload := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;

  insert into public.offline_change_log (
    device_id,
    table_name,
    operation,
    record_key,
    row_data,
    actor_user_id
  ) values (
    runtime.device_id,
    tg_table_name,
    tg_op,
    jsonb_build_object(key_column, payload -> key_column),
    case when tg_op = 'DELETE' then null else payload end,
    coalesce(auth.uid(), runtime.local_user_id)
  );

  return coalesce(new, old);
end;
$$;

do $$
declare
  target record;
begin
  for target in
    select * from (values
      ('categorias', 'id'),
      ('productos', 'id'),
      ('inventory_movements', 'id'),
      ('clientes', 'id'),
      ('cash_sessions', 'id'),
      ('cash_movements', 'id'),
      ('billing_documents', 'id'),
      ('sales', 'id'),
      ('sale_items', 'id'),
      ('payments', 'id'),
      ('billing_events', 'id'),
      ('settings', 'id'),
      ('audit_logs', 'id'),
      ('sale_counters', 'tienda_id')
    ) as tables(table_name, key_column)
  loop
    execute format(
      'create trigger capture_offline_%1$I after insert or update or delete on public.%1$I for each row execute function public.capture_offline_change(%2$L)',
      target.table_name,
      target.key_column
    );
  end loop;
end;
$$;

revoke all on public.offline_runtime from public, anon, authenticated;
revoke all on public.offline_change_log from public, anon, authenticated;
revoke execute on function public.capture_offline_change() from public, anon, authenticated;
