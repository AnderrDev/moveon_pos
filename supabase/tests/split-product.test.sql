-- =====================================================
-- pgTAP: fraccionar un producto en porciones (PLAN-113, 2026-11-01)
-- =====================================================
--   supabase test db --local supabase/tests/split-product.test.sql
-- =====================================================

begin;

create extension if not exists pgtap;

select plan(12);

do $$
declare
  v_tienda uuid := 'd1111111-1111-4111-8111-111111111111';
  v_admin  uuid := 'd2222222-2222-4222-8222-222222222221';
  v_cajero uuid := 'd2222222-2222-4222-8222-222222222222';
begin
  insert into auth.users (id, email, raw_user_meta_data) values
    (v_admin,  'pgtap-split-admin@local.test',  '{}'::jsonb),
    (v_cajero, 'pgtap-split-cajero@local.test', '{}'::jsonb)
  on conflict (id) do nothing;

  insert into public.tiendas (id, nombre) values (v_tienda, 'pgTAP split');
  insert into public.user_tiendas (user_id, tienda_id, rol, is_active) values
    (v_admin,  v_tienda, 'admin',  true),
    (v_cajero, v_tienda, 'cajero', true);

  insert into public.productos (id, tienda_id, nombre, tipo, precio_venta, costo, iva_tasa, stock_minimo, is_active) values
    ('d3333333-3333-4333-8333-333333333331', v_tienda, 'PASE 30 SERV', 'simple', 150000, 90000, 0, 0, true),
    ('d3333333-3333-4333-8333-333333333332', v_tienda, 'PASE SACHET', 'simple', 8000, null, 0, 0, true),
    ('d3333333-3333-4333-8333-333333333333', v_tienda, 'SIN COSTO', 'simple', 1000, null, 0, 0, true),
    ('d3333333-3333-4333-8333-333333333334', v_tienda, 'BATIDO', 'prepared', 1000, null, 0, 0, true);

  -- 2 tarros en punto de venta.
  insert into public.inventory_movements (tienda_id, producto_id, tipo, ubicacion, cantidad, costo_unitario, created_by)
  values (v_tienda, 'd3333333-3333-4333-8333-333333333331', 'entry', 'punto_venta', 2, 90000, v_admin);
end $$;

create temp table ids (k text primary key, v uuid);
grant all on ids to authenticated;

select set_config('request.jwt.claim.sub', 'd2222222-2222-4222-8222-222222222221', true);
set local role authenticated;

-- 1. Fracciona 1 tarro en 30 sachets
insert into ids
select 'in', (public.split_product_atomic(
  'd1111111-1111-4111-8111-111111111111',
  'd3333333-3333-4333-8333-333333333331', 1,
  'd3333333-3333-4333-8333-333333333332', 30,
  'punto_venta', null, 'd2222222-2222-4222-8222-222222222221')).id;

select is(
  (select sum(cantidad)::int from public.inventory_movements where producto_id = 'd3333333-3333-4333-8333-333333333331'),
  1, 'sale 1 tarro: quedan 1');
select is(
  (select sum(cantidad)::int from public.inventory_movements where producto_id = 'd3333333-3333-4333-8333-333333333332'),
  30, 'entran 30 sachets');
select is(
  (select costo_unitario from public.inventory_movements where id = (select v from ids where k = 'in')),
  3000.00::numeric, 'costo del sachet = 90.000 ÷ 30 = 3.000');
select is(
  (select costo from public.productos where id = 'd3333333-3333-4333-8333-333333333332'),
  3000.00::numeric, 'el costo vigente del sachet queda en 3.000');
select is(
  (select count(*)::int from public.inventory_movements where referencia_tipo = 'product_split' and tipo = 'adjustment'),
  2, 'ambos movimientos son adjustment con referencia product_split (ninguno es compra)');
select is(
  (select referencia_id from public.inventory_movements where id = (select v from ids where k = 'in')),
  (select id from public.inventory_movements where producto_id = 'd3333333-3333-4333-8333-333333333331' and tipo = 'adjustment'),
  'la entrada del sachet apunta a la salida del tarro');
select is(
  (select referencia_id from public.inventory_movements where producto_id = 'd3333333-3333-4333-8333-333333333331' and tipo = 'adjustment'),
  (select v from ids where k = 'in'),
  'la salida del tarro apunta a la entrada del sachet');
select matches(
  (select motivo from public.inventory_movements where producto_id = 'd3333333-3333-4333-8333-333333333331' and tipo = 'adjustment'),
  '^Fraccionado en 30 × PASE SACHET', 'el kardex del tarro explica en qué se fraccionó');

-- 2. Validaciones
select throws_like(
  $$ select public.split_product_atomic('d1111111-1111-4111-8111-111111111111',
       'd3333333-3333-4333-8333-333333333331', 5, 'd3333333-3333-4333-8333-333333333332', 30,
       'punto_venta', null, 'd2222222-2222-4222-8222-222222222221') $$,
  '%STOCK_INSUFICIENTE%', 'no se puede abrir más de lo que hay');
select throws_like(
  $$ select public.split_product_atomic('d1111111-1111-4111-8111-111111111111',
       'd3333333-3333-4333-8333-333333333333', 1, 'd3333333-3333-4333-8333-333333333332', 30,
       'punto_venta', null, 'd2222222-2222-4222-8222-222222222221') $$,
  '%ORIGEN_SIN_COSTO%', 'el origen necesita costo para repartirlo');
select throws_like(
  $$ select public.split_product_atomic('d1111111-1111-4111-8111-111111111111',
       'd3333333-3333-4333-8333-333333333331', 1, 'd3333333-3333-4333-8333-333333333334', 30,
       'punto_venta', null, 'd2222222-2222-4222-8222-222222222221') $$,
  '%no maneja inventario propio%', 'un preparado no puede ser destino');

reset role;
select set_config('request.jwt.claim.sub', 'd2222222-2222-4222-8222-222222222222', true);
set local role authenticated;
select throws_like(
  $$ select public.split_product_atomic('d1111111-1111-4111-8111-111111111111',
       'd3333333-3333-4333-8333-333333333331', 1, 'd3333333-3333-4333-8333-333333333332', 30,
       'punto_venta', null, 'd2222222-2222-4222-8222-222222222222') $$,
  '%Solo el admin%', 'el cajero no puede fraccionar');

reset role;
select * from finish();
rollback;
