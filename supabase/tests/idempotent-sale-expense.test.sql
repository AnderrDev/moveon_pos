-- =====================================================
-- pgTAP: idempotencia de venta y de gastos
-- =====================================================
-- Requiere 20261024000800_idempotent_sale_and_expense.sql.
--   supabase test db --local supabase/tests/idempotent-sale-expense.test.sql
-- Se ejecuta como `authenticated`.

begin;

create extension if not exists pgtap;

select plan(12);

do $$
declare
  v_tienda uuid := 'f1111111-1111-4111-8111-111111111111';
  v_admin  uuid := 'f2222222-2222-4222-8222-222222222221';
  v_cajero uuid := 'f2222222-2222-4222-8222-222222222222';
  v_ajeno  uuid := 'f2222222-2222-4222-8222-222222222223';
begin
  insert into auth.users (id, email, raw_user_meta_data) values
    (v_admin,  'pgtap-idem-admin@local.test',  '{}'::jsonb),
    (v_cajero, 'pgtap-idem-cajero@local.test', '{}'::jsonb),
    (v_ajeno,  'pgtap-idem-ajeno@local.test',  '{}'::jsonb)
  on conflict (id) do nothing;

  insert into public.tiendas (id, nombre) values (v_tienda, 'pgTAP idempotencia');

  insert into public.user_tiendas (user_id, tienda_id, rol, is_active) values
    (v_admin,  v_tienda, 'admin',  true),
    (v_cajero, v_tienda, 'cajero', true);

  insert into public.productos (id, tienda_id, nombre, tipo, precio_venta, costo, iva_tasa, stock_minimo, is_active)
  values ('f3333333-3333-4333-8333-333333333331', v_tienda, 'Whey', 'simple', 10000, 4000, 0, 0, true);

  insert into public.inventory_movements (tienda_id, producto_id, tipo, ubicacion, cantidad, created_by)
  values (v_tienda, 'f3333333-3333-4333-8333-333333333331', 'entry', 'punto_venta', 10, v_admin);

  insert into public.cash_sessions (id, tienda_id, opened_by, opening_amount, status)
  values ('f4444444-4444-4444-8444-444444444441', v_tienda, v_cajero, 0, 'open');

  insert into public.expense_categories (id, tienda_id, nombre, slug)
  values ('f5555555-5555-4555-8555-555555555551', v_tienda, 'pgTAP insumos', 'pgtap-idem-insumos');
end $$;

create function pg_temp.sell(p_key text) returns uuid language sql as $$
  select public.create_sale_atomic(
    'f1111111-1111-4111-8111-111111111111', 'f4444444-4444-4444-8444-444444444441', '',
    'f2222222-2222-4222-8222-222222222222', null, 10000, 0, 0, 10000, p_key,
    '[{"producto_id":"f3333333-3333-4333-8333-333333333331","producto_nombre":"Whey","producto_sku":null,
       "quantity":1,"unit_price":10000,"option_id":null,"discount_amount":0,"tax_rate":0,"tax_amount":0,"total":10000}]'::jsonb,
    '[{"metodo":"cash","amount":10000,"referencia":null}]'::jsonb,
    0, null, '[]'::jsonb)
$$;

select set_config('request.jwt.claim.sub', 'f2222222-2222-4222-8222-222222222222', true);
set local role authenticated;

-- ── Venta ───────────────────────────────────────────────────────────────
create temp table first_sale on commit drop as select pg_temp.sell('pgtap-idem-sale-1') as id;

select is(pg_temp.sell('pgtap-idem-sale-1'), (select id from first_sale),
  'reintentar con la misma clave devuelve la misma venta');

select is(
  (select count(*)::int from public.sales where idempotency_key = 'pgtap-idem-sale-1'),
  1, 'el reintento no crea una segunda venta');

select is(
  (select sum(cantidad)::int from public.inventory_movements
   where producto_id = 'f3333333-3333-4333-8333-333333333331'),
  9, 'el reintento no descuenta stock dos veces');

-- La caja se cierra entre el cobro y el reintento (respuesta perdida).
reset role;
update public.cash_sessions
set status = 'closed', closed_at = now(), actual_cash_amount = 10000, closing_withdrawal_amount = 0, cash_left_amount = 10000
where id = 'f4444444-4444-4444-8444-444444444441';
set local role authenticated;

select is(pg_temp.sell('pgtap-idem-sale-1'), (select id from first_sale),
  'el reintento devuelve la venta aunque la caja ya se haya cerrado');

select throws_ok(
  $$ select pg_temp.sell('pgtap-idem-sale-2') $$,
  'No hay caja abierta para esta venta', 'una venta nueva sigue exigiendo caja abierta');

select set_config('request.jwt.claim.sub', 'f2222222-2222-4222-8222-222222222223', true);

select throws_ok(
  $$ select public.create_sale_atomic(
       'f1111111-1111-4111-8111-111111111111', 'f4444444-4444-4444-8444-444444444441', '',
       'f2222222-2222-4222-8222-222222222223', null, 0, 0, 0, 0, 'pgtap-idem-sale-1',
       '[]'::jsonb, '[]'::jsonb, 0, null, '[]'::jsonb) $$,
  'Usuario sin acceso activo a la tienda',
  'un usuario ajeno ya no obtiene el id de una venta por su clave');

-- ── Gastos ──────────────────────────────────────────────────────────────
reset role;
insert into public.cash_sessions (id, tienda_id, opened_by, opening_amount, status)
values ('f4444444-4444-4444-8444-444444444442', 'f1111111-1111-4111-8111-111111111111',
        'f2222222-2222-4222-8222-222222222222', 0, 'open');
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f2222222-2222-4222-8222-222222222221', true);

create temp table first_expense on commit drop as
  select (public.register_expense_atomic(
    'f1111111-1111-4111-8111-111111111111', 'f5555555-5555-4555-8555-555555555551',
    'Hielo', 5000, 'efectivo_caja', null, null, null, null, 'pgtap-idem-exp-1')).id as id;

select is(
  (public.register_expense_atomic(
    'f1111111-1111-4111-8111-111111111111', 'f5555555-5555-4555-8555-555555555551',
    'Hielo', 5000, 'efectivo_caja', null, null, null, null, 'pgtap-idem-exp-1')).id,
  (select id from first_expense),
  'reintentar un gasto con la misma clave devuelve el mismo gasto');

select is(
  (select count(*)::int from public.expenses where idempotency_key = 'pgtap-idem-exp-1'),
  1, 'el reintento no duplica el gasto');

select is(
  (select count(*)::int from public.cash_movements
   where cash_session_id = 'f4444444-4444-4444-8444-444444444442' and tipo = 'expense'),
  1, 'el reintento no duplica el egreso de caja');

select isnt(
  (public.register_expense_atomic(
    'f1111111-1111-4111-8111-111111111111', 'f5555555-5555-4555-8555-555555555551',
    'Hielo', 5000, 'efectivo_caja', null, null, null, null, 'pgtap-idem-exp-2')).id,
  (select id from first_expense),
  'una clave nueva registra un gasto nuevo');

select lives_ok(
  $$ select public.register_expense_atomic(
       'f1111111-1111-4111-8111-111111111111', 'f5555555-5555-4555-8555-555555555551',
       'Sin clave', 1000, 'transferencia') $$,
  'la firma anterior (sin clave) sigue funcionando');

select set_config('request.jwt.claim.sub', 'f2222222-2222-4222-8222-222222222222', true);

select throws_ok(
  $$ select public.register_expense_atomic(
       'f1111111-1111-4111-8111-111111111111', 'f5555555-5555-4555-8555-555555555551',
       'Hielo', 5000, 'efectivo_caja', null, null, null, null, 'pgtap-idem-exp-1') $$,
  'Solo el admin puede registrar gastos', 'un cajero no obtiene un gasto ajeno por su clave');

select * from finish();

rollback;
