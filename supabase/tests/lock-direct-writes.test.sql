-- =====================================================
-- pgTAP: sin escrituras directas a ventas, pagos, caja y auditoría
-- =====================================================
-- Requiere 20261024000200 y 20261024000300.
--   supabase test db --local supabase/tests/lock-direct-writes.test.sql
-- Se ejecuta como `authenticated` (lo que usa el cliente con su JWT).

begin;

create extension if not exists pgtap;

select plan(28);

do $$
declare
  v_tienda  uuid := 'b1111111-1111-4111-8111-111111111111';
  v_otra    uuid := 'b1111111-1111-4111-8111-111111111112';
  v_admin   uuid := 'b2222222-2222-4222-8222-222222222221';
  v_cajero  uuid := 'b2222222-2222-4222-8222-222222222222';
  v_ajeno   uuid := 'b2222222-2222-4222-8222-222222222223';
begin
  insert into auth.users (id, email, raw_user_meta_data) values
    (v_admin,  'pgtap-lock-admin@local.test',  '{}'::jsonb),
    (v_cajero, 'pgtap-lock-cajero@local.test', '{}'::jsonb),
    (v_ajeno,  'pgtap-lock-ajeno@local.test',  '{}'::jsonb)
  on conflict (id) do nothing;

  insert into public.tiendas (id, nombre) values
    (v_tienda, 'pgTAP bloqueo'), (v_otra, 'pgTAP otra tienda');

  insert into public.user_tiendas (user_id, tienda_id, rol, is_active) values
    (v_admin,  v_tienda, 'admin',  true),
    (v_cajero, v_tienda, 'cajero', true),
    (v_ajeno,  v_otra,   'admin',  true);

  insert into public.cash_sessions (id, tienda_id, opened_by, opening_amount, status) values
    ('b3333333-3333-4333-8333-333333333331', v_tienda, v_cajero, 100000, 'open');
  insert into public.cash_sessions (
    id, tienda_id, opened_by, opening_amount, status, closed_at,
    actual_cash_amount, closing_withdrawal_amount, cash_left_amount
  ) values (
    'b3333333-3333-4333-8333-333333333332', v_tienda, v_cajero, 50000, 'closed', now(),
    50000, 0, 50000
  );

  insert into public.expense_categories (id, tienda_id, nombre, slug) values
    ('b5555555-5555-4555-8555-555555555551', v_tienda, 'pgTAP insumos', 'pgtap-insumos');

  insert into public.productos (
    id, tienda_id, nombre, tipo, precio_venta, costo, iva_tasa, stock_minimo, is_active
  ) values (
    'b6666666-6666-4666-8666-666666666661', v_tienda, 'pgTAP proteína', 'simple', 10000, 4000, 0, 0, true
  );

  insert into public.inventory_movements (tienda_id, producto_id, tipo, ubicacion, cantidad, created_by)
  values (v_tienda, 'b6666666-6666-4666-8666-666666666661', 'entry', 'punto_venta', 5, v_admin);

  -- El trigger de identidad del cajero lee auth.uid().
  perform set_config('request.jwt.claim.sub', v_cajero::text, true);

  insert into public.sales (
    id, tienda_id, cash_session_id, sale_number, cashier_id, subtotal, total, idempotency_key
  ) values (
    'b4444444-4444-4444-8444-444444444441', v_tienda,
    'b3333333-3333-4333-8333-333333333331', 'PGTAP-1', v_cajero, 10000, 10000, 'pgtap-lock-1'
  );

  insert into public.payments (sale_id, metodo, amount)
  values ('b4444444-4444-4444-8444-444444444441', 'cash', 10000);

  insert into public.audit_logs (tienda_id, user_id, action, entity_type)
  values (v_tienda, v_cajero, 'pgtap.seed', 'pgtap');
end $$;

-- ── Como cajero autenticado ─────────────────────────────────────────────
select set_config('request.jwt.claim.sub', 'b2222222-2222-4222-8222-222222222222', true);
set local role authenticated;

select is(
  (select count(*)::int from public.sales where id = 'b4444444-4444-4444-8444-444444444441'),
  1, 'cajero sigue leyendo las ventas de su tienda'
);

select is(
  (select count(*)::int from public.payments where sale_id = 'b4444444-4444-4444-8444-444444444441'),
  1, 'cajero sigue leyendo los pagos de su tienda'
);

select throws_ok(
  $$ delete from public.sales where id = 'b4444444-4444-4444-8444-444444444441' $$,
  '42501', null, 'cajero no puede borrar ventas'
);

select throws_ok(
  $$ update public.sales set total = 1 where id = 'b4444444-4444-4444-8444-444444444441' $$,
  '42501', null, 'cajero no puede modificar ventas'
);

select throws_ok(
  $$ delete from public.payments where sale_id = 'b4444444-4444-4444-8444-444444444441' $$,
  '42501', null, 'cajero no puede borrar pagos'
);

select throws_ok(
  $$ update public.payments set amount = 1 where sale_id = 'b4444444-4444-4444-8444-444444444441' $$,
  '42501', null, 'cajero no puede modificar pagos'
);

select throws_ok(
  $$ insert into public.payments (sale_id, metodo, amount)
     values ('b4444444-4444-4444-8444-444444444441', 'cash', 5000) $$,
  '42501', null, 'cajero no puede insertar pagos directo'
);

select throws_ok(
  $$ delete from public.sale_items where sale_id = 'b4444444-4444-4444-8444-444444444441' $$,
  '42501', null, 'cajero no puede borrar items de venta'
);

select throws_ok(
  $$ update public.sale_counters set last_number = 0 $$,
  '42501', null, 'cajero no puede tocar el correlativo de ventas'
);

select throws_ok(
  $$ delete from public.audit_logs where action = 'pgtap.seed' $$,
  '42501', null, 'cajero no puede borrar auditoría'
);

select throws_ok(
  $$ update public.audit_logs set action = 'x' where action = 'pgtap.seed' $$,
  '42501', null, 'cajero no puede modificar auditoría'
);

select lives_ok(
  $$ insert into public.audit_logs (tienda_id, user_id, action, entity_type)
     values ('b1111111-1111-4111-8111-111111111111',
             'b2222222-2222-4222-8222-222222222222', 'pgtap.own', 'pgtap') $$,
  'cajero puede auditar a su nombre en su tienda'
);

select throws_ok(
  $$ insert into public.audit_logs (tienda_id, user_id, action, entity_type)
     values ('b1111111-1111-4111-8111-111111111111',
             'b2222222-2222-4222-8222-222222222221', 'pgtap.forged', 'pgtap') $$,
  '42501', null, 'cajero no puede auditar suplantando a otro usuario'
);

select throws_ok(
  $$ insert into public.cash_movements (cash_session_id, tipo, amount, motivo, created_by)
     values ('b3333333-3333-4333-8333-333333333331', 'cash_in', 1000, 'directo',
             'b2222222-2222-4222-8222-222222222222') $$,
  '42501', null, 'cajero no puede insertar movimientos de caja directo'
);

select lives_ok(
  $$ select public.add_cash_movement_atomic(
       'b3333333-3333-4333-8333-333333333331', 'cash_in', 20000, 'Base adicional',
       'b2222222-2222-4222-8222-222222222222') $$,
  'cajero registra un movimiento en caja abierta vía RPC'
);

select is(
  (select count(*)::int from public.cash_movements
   where cash_session_id = 'b3333333-3333-4333-8333-333333333331' and motivo = 'Base adicional'),
  1, 'el movimiento quedó registrado'
);

select throws_ok(
  $$ select public.add_cash_movement_atomic(
       'b3333333-3333-4333-8333-333333333332', 'cash_out', 1000, 'Caja cerrada',
       'b2222222-2222-4222-8222-222222222222') $$,
  'La sesión de caja ya está cerrada', 'no se registran movimientos en una caja cerrada'
);

select throws_ok(
  $$ select public.add_cash_movement_atomic(
       'b3333333-3333-4333-8333-333333333331', 'cash_out', 1000, 'Suplantación',
       'b2222222-2222-4222-8222-222222222221') $$,
  'No autenticado', 'no se registran movimientos a nombre de otro usuario'
);

select throws_ok(
  $$ delete from public.cash_sessions where id = 'b3333333-3333-4333-8333-333333333332' $$,
  '42501', null, 'cajero no puede borrar sesiones de caja'
);

select throws_ok(
  $$ insert into public.cash_sessions (tienda_id, opened_by, opening_amount, status, closed_at)
     values ('b1111111-1111-4111-8111-111111111111',
             'b2222222-2222-4222-8222-222222222222', 0, 'closed', now()) $$,
  '42501', null, 'cajero no puede insertar una sesión ya cerrada'
);

select throws_ok(
  $$ select public.register_expense_atomic(
       'b1111111-1111-4111-8111-111111111111', 'b5555555-5555-4555-8555-555555555551',
       'Hielo', 5000, 'efectivo_caja') $$,
  'Solo el admin puede registrar gastos', 'cajero no puede registrar gastos'
);

-- Las RPC DEFINER siguen escribiendo aunque el rol ya no pueda hacerlo.
select lives_ok(
  $$ select public.create_sale_atomic(
       'b1111111-1111-4111-8111-111111111111', 'b3333333-3333-4333-8333-333333333331', '',
       'b2222222-2222-4222-8222-222222222222', null,
       10000, 0, 0, 10000, 'pgtap-lock-rpc-sale',
       '[{"producto_id":"b6666666-6666-4666-8666-666666666661","producto_nombre":"pgTAP proteína",
          "producto_sku":null,"quantity":1,"unit_price":10000,"option_id":null,
          "discount_amount":0,"tax_rate":0,"tax_amount":0,"total":10000}]'::jsonb,
       '[{"metodo":"cash","amount":10000,"referencia":null}]'::jsonb,
       0, null, '[]'::jsonb) $$,
  'cajero crea una venta vía create_sale_atomic'
);

select lives_ok(
  $$ select public.correct_payment_atomic(
       (select p.id from public.payments p join public.sales s on s.id = p.sale_id
        where s.idempotency_key = 'pgtap-lock-rpc-sale'),
       'b1111111-1111-4111-8111-111111111111', 'transfer',
       'b2222222-2222-4222-8222-222222222222', 'El cliente pagó por transferencia') $$,
  'cajero corrige el método de pago vía RPC'
);

-- ── Como usuario de otra tienda ─────────────────────────────────────────
select set_config('request.jwt.claim.sub', 'b2222222-2222-4222-8222-222222222223', true);

select throws_ok(
  $$ select public.add_cash_movement_atomic(
       'b3333333-3333-4333-8333-333333333331', 'cash_in', 1000, 'Otra tienda',
       'b2222222-2222-4222-8222-222222222223') $$,
  'Sesión de caja no encontrada', 'otra tienda no puede mover una caja ajena'
);

-- ── Como admin ──────────────────────────────────────────────────────────
select set_config('request.jwt.claim.sub', 'b2222222-2222-4222-8222-222222222221', true);

select lives_ok(
  $$ select public.register_expense_atomic(
       'b1111111-1111-4111-8111-111111111111', 'b5555555-5555-4555-8555-555555555551',
       'Hielo', 5000, 'efectivo_caja') $$,
  'admin registra un gasto en efectivo (DEFINER inserta el movimiento)'
);

select is(
  (select count(*)::int from public.cash_movements
   where cash_session_id = 'b3333333-3333-4333-8333-333333333331' and tipo = 'expense'),
  1, 'el gasto en efectivo generó su movimiento de caja'
);

select lives_ok(
  $$ select public.void_sale_atomic(
       (select id from public.sales where idempotency_key = 'pgtap-lock-rpc-sale'),
       'b1111111-1111-4111-8111-111111111111',
       'b2222222-2222-4222-8222-222222222221', 'Venta de prueba anulada') $$,
  'admin anula una venta vía void_sale_atomic'
);

select is(
  (select status::text from public.sales where idempotency_key = 'pgtap-lock-rpc-sale'),
  'voided', 'la venta queda anulada, no borrada'
);

select * from finish();

rollback;
