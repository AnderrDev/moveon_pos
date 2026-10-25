-- =====================================================================
-- Borra los datos del seed del asesor de compras — SOLO SUPABASE LOCAL
-- =====================================================================
--   pnpm seed:asesor:limpiar
-- Quita productos, ventas, cajas y movimientos "SIM" y el esquema `sim`.
-- =====================================================================

\set ON_ERROR_STOP on

begin;

-- Fechas en hora de la tienda (current_date usa la zona de la sesión).
set local timezone = 'America/Bogota';

-- ---------- Guardia: solo la tienda demo local ----------
do $$
begin
  if not exists (
    select 1 from public.tiendas
    where id = '00000000-0000-0000-0000-000000000001' and nombre = 'MOVEONAPP Tienda Demo'
  ) or not exists (select 1 from auth.users where email = 'admin@moveon.local') then
    raise exception 'seed-asesor-compras: solo se ejecuta en el Supabase LOCAL (tienda demo + admin@moveon.local)';
  end if;
end $$;

-- ---------- Limpieza ----------
drop table if exists sim.daily_demand;
drop table if exists sim.products;

delete from public.inventory_movements
where producto_id in (select id from public.productos where nombre like 'SIM · %')
   or (referencia_tipo = 'sale' and referencia_id in (select id from public.sales where sale_number like 'SIM-%'));
delete from public.payments where sale_id in (select id from public.sales where sale_number like 'SIM-%');
delete from public.sale_items where sale_id in (select id from public.sales where sale_number like 'SIM-%');
delete from public.audit_logs where entity_id in (select id from public.sales where sale_number like 'SIM-%')
   or entity_id in (select id from public.productos where nombre like 'SIM · %');
delete from public.sales where sale_number like 'SIM-%';
delete from public.cash_sessions where notas_cierre = 'SIM';
delete from public.product_components where producto_id in (select id from public.productos where nombre like 'SIM · %');
delete from public.productos where nombre like 'SIM · %';
delete from public.proveedores where nombre like 'SIM · %';
delete from public.categorias where nombre like 'SIM · %';

drop schema if exists sim cascade;

commit;
