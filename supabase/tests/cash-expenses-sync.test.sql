-- =====================================================
-- pgTAP: gastos de caja ↔ finanzas y pago de entradas (Ola 1, 2026-10-24)
-- =====================================================
--   supabase test db --local supabase/tests/cash-expenses-sync.test.sql
-- =====================================================

begin;

create extension if not exists pgtap;

select plan(18);

-- ----------------- Setup -----------------
do $$
declare
  v_tienda  uuid := 'a1111111-1111-1111-1111-111111111111';
  v_admin   uuid := 'a2222222-2222-2222-2222-222222222222';
  v_cajero  uuid := 'a3333333-3333-3333-3333-333333333333';
begin
  insert into auth.users (id, email, raw_user_meta_data) values
    (v_admin, 'ola1-admin@local.test', '{}'::jsonb),
    (v_cajero, 'ola1-cajero@local.test', '{}'::jsonb)
  on conflict (id) do nothing;

  insert into public.tiendas (id, nombre, timezone) values (v_tienda, 'pgTAP Ola 1', 'America/Bogota');
  insert into public.user_tiendas (user_id, tienda_id, rol, is_active) values
    (v_admin, v_tienda, 'admin', true),
    (v_cajero, v_tienda, 'cajero', true);

  insert into public.cash_sessions (id, tienda_id, opened_by, opening_amount, status)
  values ('a4444444-4444-4444-4444-444444444444', v_tienda, v_admin, 100000, 'open');

  insert into public.expense_categories (id, tienda_id, nombre, slug, tipo)
  values ('a5555555-5555-5555-5555-555555555555', v_tienda, 'Arriendo', 'arriendo', 'fijo');

  insert into public.productos (id, tienda_id, nombre, tipo, precio_venta, costo, iva_tasa, stock_minimo, is_active)
  values ('a6666666-6666-6666-6666-666666666666', v_tienda, 'Proteína Ola 1', 'simple', 100000, 50000, 0, 0, true);
end $$;

create temp table ids (k text primary key, v uuid);
grant all on ids to authenticated;

-- ----------------- Cajero: gasto desde caja -----------------
select set_config('request.jwt.claim.sub', 'a3333333-3333-3333-3333-333333333333', true);
set local role authenticated;

insert into ids
select 'mov_hielo', (public.add_cash_movement_atomic(
  'a4444444-4444-4444-4444-444444444444', 'expense', 12000, 'Hielo y banano',
  'a3333333-3333-3333-3333-333333333333')).id;

reset role;

-- 1-3. El gasto de caja aparece en finanzas, en "Gastos de caja"
select is(
  (select count(*)::int from public.expenses where cash_movement_id = (select v from ids where k = 'mov_hielo')),
  1, 'un gasto de caja crea su gasto en finanzas');
select is(
  (select c.slug from public.expenses e join public.expense_categories c on c.id = e.category_id
   where e.cash_movement_id = (select v from ids where k = 'mov_hielo')),
  'caja', 'el gasto de caja queda en la categoría Gastos de caja');
select is(
  (select row(monto, concepto, metodo_pago, created_by)::text from public.expenses
   where cash_movement_id = (select v from ids where k = 'mov_hielo')),
  row(12000.00::numeric(14,2), 'Hielo y banano'::text, 'efectivo_caja'::text, 'a3333333-3333-3333-3333-333333333333'::uuid)::text,
  'el gasto copia monto, concepto, método y autor');

-- 4. Otros tipos de movimiento no crean gasto
select set_config('request.jwt.claim.sub', 'a3333333-3333-3333-3333-333333333333', true);
set local role authenticated;
insert into ids
select 'mov_retiro', (public.add_cash_movement_atomic(
  'a4444444-4444-4444-4444-444444444444', 'cash_out', 5000, 'Retiro parcial',
  'a3333333-3333-3333-3333-333333333333')).id;
reset role;
select is(
  (select count(*)::int from public.expenses where cash_movement_id = (select v from ids where k = 'mov_retiro')),
  0, 'una salida que no es gasto no crea gasto');

-- ----------------- Admin -----------------
select set_config('request.jwt.claim.sub', 'a2222222-2222-2222-2222-222222222222', true);
set local role authenticated;

-- 5. Corregir el monto en caja corrige el gasto
select public.correct_cash_movement_atomic(
  (select v from ids where k = 'mov_hielo'), 'a1111111-1111-1111-1111-111111111111',
  15000, 'Hielo, banano y leche', 'a2222222-2222-2222-2222-222222222222', 'Faltó la leche en el registro');
select is(
  (select row(monto, concepto)::text from public.expenses where cash_movement_id = (select v from ids where k = 'mov_hielo')),
  row(15000.00::numeric(14,2), 'Hielo, banano y leche'::text)::text,
  'corregir la salida de caja corrige monto y concepto del gasto');

-- 6. Anular en caja anula el gasto
select public.void_cash_movement_atomic(
  (select v from ids where k = 'mov_hielo'), 'a1111111-1111-1111-1111-111111111111',
  'a2222222-2222-2222-2222-222222222222', 'Registrado dos veces');
select is(
  (select status from public.expenses where cash_movement_id = (select v from ids where k = 'mov_hielo')),
  'voided', 'anular la salida de caja anula el gasto');

-- 7-8. Gasto de finanzas pagado con caja: anularlo anula la salida
insert into ids
select 'exp_arriendo', (public.register_expense_atomic(
  'a1111111-1111-1111-1111-111111111111', 'a5555555-5555-5555-5555-555555555555',
  'Arriendo octubre', 30000, 'efectivo_caja')).id;
select is(
  (select cm.motivo from public.expenses e join public.cash_movements cm on cm.id = e.cash_movement_id
   where e.id = (select v from ids where k = 'exp_arriendo')),
  'Gasto: Arriendo octubre', 'el gasto con efectivo de caja crea su salida');

select public.void_expense_atomic(
  (select v from ids where k = 'exp_arriendo'), 'a1111111-1111-1111-1111-111111111111', 'Se pagó por transferencia');
select is(
  (select row(e.status, cm.status::text)::text from public.expenses e join public.cash_movements cm on cm.id = e.cash_movement_id
   where e.id = (select v from ids where k = 'exp_arriendo')),
  row('voided'::text, 'voided'::text)::text,
  'anular el gasto anula también su salida de caja');

-- 9. Anular dos veces se rechaza
select throws_ok(
  $$ select public.void_expense_atomic((select v from ids where k = 'exp_arriendo'),
       'a1111111-1111-1111-1111-111111111111', 'Otra vez el mismo') $$,
  'P0001', null, 'no se puede anular un gasto ya anulado');

-- 10. Ya no hay UPDATE directo sobre expenses
select throws_ok(
  $$ update public.expenses set monto = 1 where id = (select v from ids where k = 'exp_arriendo') $$,
  '42501', null, 'authenticated no puede escribir expenses directamente');

-- ----------------- Entradas de inventario -----------------
-- 11. Payload anterior (sin método): sin salida de caja
insert into ids
select 'ent_sin', public.register_inventory_entry_atomic(
  'a1111111-1111-1111-1111-111111111111', 'a6666666-6666-6666-6666-666666666666',
  'punto_venta', 2, 50000, null, 'a2222222-2222-2222-2222-222222222222');
select is(
  (select row(metodo_pago, cash_movement_id)::text from public.inventory_movements where id = (select v from ids where k = 'ent_sin')),
  row(null::text, null::uuid)::text, 'la entrada sin método no toca la caja');

-- 12-13. Pagada con efectivo de caja: crea la salida por el total
insert into ids
select 'ent_caja', public.register_inventory_entry_atomic(
  'a1111111-1111-1111-1111-111111111111', 'a6666666-6666-6666-6666-666666666666',
  'punto_venta', 3, 52000, 'Compra a distribuidor', 'a2222222-2222-2222-2222-222222222222', 'efectivo_caja');
select is(
  (select row(cm.tipo::text, cm.amount, cm.motivo)::text from public.inventory_movements m
   join public.cash_movements cm on cm.id = m.cash_movement_id where m.id = (select v from ids where k = 'ent_caja')),
  row('cash_out'::text, 156000.00::numeric(14,2), 'Compra mercancía: Proteína Ola 1 x3'::text)::text,
  'la compra con efectivo de caja crea la salida por cantidad × costo');
select is(
  (select count(*)::int from public.expenses e join public.inventory_movements m on m.cash_movement_id = e.cash_movement_id
   where m.id = (select v from ids where k = 'ent_caja')),
  0, 'la compra de mercancía no se registra como gasto');

-- 14. Transferencia: guarda el método, sin caja
insert into ids
select 'ent_transf', public.register_inventory_entry_atomic(
  'a1111111-1111-1111-1111-111111111111', 'a6666666-6666-6666-6666-666666666666',
  'bodega', 1, 52000, null, 'a2222222-2222-2222-2222-222222222222', 'transferencia');
select is(
  (select row(metodo_pago, cash_movement_id)::text from public.inventory_movements where id = (select v from ids where k = 'ent_transf')),
  row('transferencia'::text, null::uuid)::text, 'la compra por transferencia guarda el método sin tocar la caja');

-- 15. Efectivo de caja sin costo se rechaza
select throws_ok(
  $$ select public.register_inventory_entry_atomic('a1111111-1111-1111-1111-111111111111',
       'a6666666-6666-6666-6666-666666666666', 'bodega', 1, null, null,
       'a2222222-2222-2222-2222-222222222222', 'efectivo_caja') $$,
  'P0001', 'Para pagar con efectivo de caja registra el costo de la compra',
  'pagar con caja exige el costo');

-- 16. Método inválido se rechaza
select throws_ok(
  $$ select public.register_inventory_entry_atomic('a1111111-1111-1111-1111-111111111111',
       'a6666666-6666-6666-6666-666666666666', 'bodega', 1, 1000, null,
       'a2222222-2222-2222-2222-222222222222', 'fiado') $$,
  'P0001', 'Método de pago inválido', 'el método de pago se valida');

-- 17. Corregir el costo con la caja abierta ajusta la salida
select public.correct_inventory_entry_cost_atomic(
  (select v from ids where k = 'ent_caja'), 'a1111111-1111-1111-1111-111111111111',
  50000, false, 'a2222222-2222-2222-2222-222222222222', 'El proveedor hizo descuento');
select is(
  (select cm.amount from public.inventory_movements m join public.cash_movements cm on cm.id = m.cash_movement_id
   where m.id = (select v from ids where k = 'ent_caja')),
  150000.00::numeric(14,2), 'corregir el costo ajusta la salida de caja abierta');

-- 18. Sin caja abierta, pagar con caja se rechaza
reset role;
update public.cash_sessions set status = 'closed', closed_at = now(), actual_cash_amount = 0,
  closing_withdrawal_amount = 0, cash_left_amount = 0
where id = 'a4444444-4444-4444-4444-444444444444';
set local role authenticated;
select throws_ok(
  $$ select public.register_inventory_entry_atomic('a1111111-1111-1111-1111-111111111111',
       'a6666666-6666-6666-6666-666666666666', 'bodega', 1, 1000, null,
       'a2222222-2222-2222-2222-222222222222', 'efectivo_caja') $$,
  'P0001', 'No hay una caja abierta: abre la caja o elige otro método de pago',
  'pagar con caja exige una caja abierta');

select * from finish();

rollback;
