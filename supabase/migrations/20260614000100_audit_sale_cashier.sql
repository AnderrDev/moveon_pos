-- Garantiza que cada venta quede vinculada al usuario autenticado que la crea.
-- `cashier_email` es un snapshot legible: conserva el dato aunque el usuario
-- cambie posteriormente su correo en Auth.

alter table public.sales
  add column if not exists cashier_email text;

update public.sales s
set cashier_email = u.email
from auth.users u
where u.id = s.cashier_id
  and s.cashier_email is null;

create index if not exists ix_sales_cashier
  on public.sales (tienda_id, cashier_id, created_at desc);

create or replace function public.enforce_sale_cashier_identity()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
begin
  if v_user_id is null then
    raise exception 'No autenticado';
  end if;

  if new.cashier_id is distinct from v_user_id then
    raise exception 'El usuario de la venta no coincide con la sesión autenticada';
  end if;

  if not exists (
    select 1
    from public.user_tiendas
    where user_id = v_user_id
      and tienda_id = new.tienda_id
      and is_active = true
  ) then
    raise exception 'El usuario no está activo en la tienda de la venta';
  end if;

  v_email := nullif(auth.jwt() ->> 'email', '');
  if v_email is null then
    select email into v_email
    from auth.users
    where id = v_user_id;
  end if;

  new.cashier_id := v_user_id;
  new.cashier_email := v_email;
  return new;
end;
$$;

revoke execute on function public.enforce_sale_cashier_identity() from public, anon, authenticated;

drop trigger if exists sales_enforce_cashier_identity on public.sales;
create trigger sales_enforce_cashier_identity
  before insert on public.sales
  for each row execute function public.enforce_sale_cashier_identity();

comment on column public.sales.cashier_id is
  'UUID del usuario autenticado que realizó la venta; protegido por trigger.';

comment on column public.sales.cashier_email is
  'Snapshot del correo del usuario que realizó la venta para auditoría legible.';
