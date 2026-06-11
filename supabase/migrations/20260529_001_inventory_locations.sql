-- =====================================================
-- PLAN-23: Inventario por ubicación (base schema)
-- =====================================================
-- Agrega la dimensión física del inventario:
--   - punto_venta: stock vendible en mostrador.
--   - bodega: stock de respaldo.
--
-- Esta migración NO usa los nuevos valores transfer_in/transfer_out. Solo los
-- registra en el enum para que una migración posterior, en otra transacción,
-- pueda crear el RPC de traslado sin chocar con la restricción de Postgres:
-- "unsafe use of new value ... New enum values must be committed before use".
-- =====================================================

do $$
begin
  create type public.inventory_location as enum ('punto_venta', 'bodega');
exception
  when duplicate_object then null;
end $$;

alter type public.inventory_movement_type add value if not exists 'transfer_out';
alter type public.inventory_movement_type add value if not exists 'transfer_in';

alter table public.inventory_movements
  add column if not exists ubicacion public.inventory_location not null default 'punto_venta';

create index if not exists ix_inv_mov_producto_ubicacion
  on public.inventory_movements (tienda_id, producto_id, ubicacion, created_at desc);

drop function if exists public.get_stock(uuid, uuid);

create or replace function public.get_stock(
  p_producto_id uuid,
  p_tienda_id uuid,
  p_ubicacion public.inventory_location default 'punto_venta'
)
returns numeric
language sql
stable
set search_path = public
as $$
  select coalesce(sum(cantidad), 0)
  from public.inventory_movements
  where producto_id = p_producto_id
    and tienda_id = p_tienda_id
    and ubicacion = p_ubicacion;
$$;

comment on function public.get_stock(uuid, uuid, public.inventory_location) is
  'Calcula stock por producto, tienda y ubicación. El default punto_venta conserva compatibilidad con callers de 2 argumentos.';

revoke execute on function public.get_stock(uuid, uuid, public.inventory_location) from public, anon;
grant execute on function public.get_stock(uuid, uuid, public.inventory_location) to authenticated;
