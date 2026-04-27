-- ============================================================
-- MIGRACIÓN 1 — MOVEONAPP POS
-- Enums, tablas base (tiendas, user_tiendas, audit_logs),
-- función trigger updated_at y helper get_user_tiendas
-- ============================================================

-- ==================== ENUMS ====================

create type user_role              as enum ('admin', 'cajero');
create type product_type           as enum ('simple', 'prepared', 'ingredient');
create type sale_status            as enum ('completed', 'voided');
create type billing_status         as enum ('not_required', 'pending', 'sent', 'accepted', 'rejected', 'failed');
create type billing_doc_status     as enum ('pending', 'sent', 'accepted', 'rejected', 'cancelled', 'failed');
create type billing_doc_type       as enum ('invoice', 'pos_document', 'credit_note');
create type payment_method         as enum ('cash', 'card', 'nequi', 'daviplata', 'transfer', 'other');
create type cash_session_status    as enum ('open', 'closed');
create type cash_movement_type     as enum ('cash_in', 'cash_out', 'expense', 'correction');
create type inventory_movement_type as enum ('entry', 'sale_exit', 'adjustment', 'void_return');

-- ==================== HELPER TRIGGER ====================

create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ==================== TIENDAS ====================

create table tiendas (
  id          uuid        primary key default gen_random_uuid(),
  nombre      text        not null,
  nit         text,
  direccion   text,
  telefono    text,
  ciudad      text,
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger tiendas_updated_at before update on tiendas
  for each row execute function update_updated_at();

-- ==================== USER_TIENDAS ====================

create table user_tiendas (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  tienda_id   uuid        not null references tiendas(id) on delete cascade,
  rol         user_role   not null default 'cajero',
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now(),
  unique (user_id, tienda_id)
);

-- ==================== AUDIT_LOGS ====================

create table audit_logs (
  id          uuid        primary key default gen_random_uuid(),
  tienda_id   uuid        references tiendas(id),
  user_id     uuid        references auth.users(id),
  action      text        not null,
  entity_type text,
  entity_id   uuid,
  metadata    jsonb,
  created_at  timestamptz not null default now()
);

create index ix_audit_logs_tienda_created on audit_logs (tienda_id, created_at desc);
create index ix_audit_logs_entity         on audit_logs (entity_type, entity_id);

-- ==================== RLS ====================

alter table tiendas      enable row level security;
alter table user_tiendas enable row level security;
alter table audit_logs   enable row level security;

create policy "tenant_select" on tiendas for select
  using (
    id in (
      select tienda_id from user_tiendas
      where user_id = auth.uid() and is_active = true
    )
  );

create policy "own_rows_select" on user_tiendas for select
  using (user_id = auth.uid());

create policy "tenant_select" on audit_logs for select
  using (
    tienda_id in (
      select tienda_id from user_tiendas
      where user_id = auth.uid() and is_active = true
    )
  );

-- ==================== HELPER FUNCTION ====================

create or replace function get_user_tiendas()
returns setof uuid language sql security definer stable as $$
  select tienda_id from user_tiendas
  where user_id = auth.uid() and is_active = true;
$$;
