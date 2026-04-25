-- ============================================================
-- MIGRACIÓN INICIAL — MOVEONAPP POS
-- Sprint 0: tablas base tiendas, user_tiendas, audit_logs
-- ============================================================

-- Tipos enum
create type user_role as enum ('admin', 'cajero');
create type product_type as enum ('simple', 'prepared', 'ingredient');
create type sale_status as enum ('completed', 'voided');
create type payment_method as enum ('cash', 'card', 'transfer', 'other');
create type cash_session_status as enum ('open', 'closed');
create type inventory_movement_type as enum ('entrada', 'salida', 'ajuste', 'venta', 'anulacion');

-- Tabla tiendas
create table tiendas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  nit text,
  direccion text,
  telefono text,
  email text,
  logo_url text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Relación usuarios ↔ tiendas
create table user_tiendas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tienda_id uuid not null references tiendas(id) on delete cascade,
  rol user_role not null default 'cajero',
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, tienda_id)
);

-- Audit log genérico
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid references tiendas(id),
  user_id uuid references auth.users(id),
  action text not null,
  table_name text,
  record_id text,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz not null default now()
);

-- RLS
alter table tiendas enable row level security;
alter table user_tiendas enable row level security;
alter table audit_logs enable row level security;

-- Política: usuarios autenticados solo ven sus tiendas
create policy "usuarios ven sus tiendas"
  on tiendas for select
  using (
    id in (
      select tienda_id from user_tiendas
      where user_id = auth.uid() and activo = true
    )
  );

create policy "usuarios ven sus user_tiendas"
  on user_tiendas for select
  using (user_id = auth.uid());

create policy "usuarios ven audit_logs de su tienda"
  on audit_logs for select
  using (
    tienda_id in (
      select tienda_id from user_tiendas
      where user_id = auth.uid() and activo = true
    )
  );

-- Función helper: tiendas del usuario actual
create or replace function get_user_tiendas()
returns setof uuid
language sql
security definer
as $$
  select tienda_id from user_tiendas
  where user_id = auth.uid() and activo = true;
$$;

-- Trigger updated_at automático
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tiendas_updated_at before update on tiendas
  for each row execute function update_updated_at();

create trigger user_tiendas_updated_at before update on user_tiendas
  for each row execute function update_updated_at();
