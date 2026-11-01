-- =====================================================
-- pgTAP: retiros del dueño y totales de los sobres (ADR 0025, 2026-11-01)
-- =====================================================
--   supabase test db --local supabase/tests/owner-withdrawals.test.sql
-- =====================================================

begin;

create extension if not exists pgtap;

select plan(16);

-- ----------------- Setup -----------------
do $$
declare
  v_tienda  uuid := 'b1111111-1111-1111-1111-111111111111';
  v_admin   uuid := 'b2222222-2222-2222-2222-222222222222';
  v_cajero  uuid := 'b3333333-3333-3333-3333-333333333333';
begin
  insert into auth.users (id, email, raw_user_meta_data) values
    (v_admin, 'sobres-admin@local.test', '{}'::jsonb),
    (v_cajero, 'sobres-cajero@local.test', '{}'::jsonb)
  on conflict (id) do nothing;

  insert into public.tiendas (id, nombre, timezone) values (v_tienda, 'pgTAP Sobres', 'America/Bogota');
  insert into public.user_tiendas (user_id, tienda_id, rol, is_active) values
    (v_admin, v_tienda, 'admin', true),
    (v_cajero, v_tienda, 'cajero', true);

  insert into public.cash_sessions (id, tienda_id, opened_by, opening_amount, status)
  values ('b4444444-4444-4444-4444-444444444444', v_tienda, v_admin, 300000, 'open');

  insert into public.expense_categories (id, tienda_id, nombre, slug, tipo) values
    ('b5555555-5555-5555-5555-555555555555', v_tienda, 'Arriendo', 'arriendo', 'fijo'),
    ('b5555555-5555-5555-5555-555555555556', v_tienda, 'Nómina', 'nomina', 'fijo'),
    ('b5555555-5555-5555-5555-555555555557', v_tienda, 'Otros', 'otros', 'variable');

  insert into public.expense_templates (tienda_id, category_id, concepto, monto_sugerido, frecuencia, is_active)
  values (v_tienda, 'b5555555-5555-5555-5555-555555555555', 'Arriendo local', 2500000, 'mensual', true);

  insert into public.empleados (id, tienda_id, nombre, salario_mensual, is_active)
  values ('b7777777-7777-7777-7777-777777777777', v_tienda, 'Gustavo', 1800000, true);

  -- Gastos: arriendo por plantilla (fijo), nómina por empleado (fijo), hielo (día a día).
  insert into public.expenses (tienda_id, category_id, empleado_id, concepto, monto, fecha_gasto, metodo_pago, created_by) values
    (v_tienda, 'b5555555-5555-5555-5555-555555555555', null, 'Arriendo local', 2500000, '2026-11-02', 'transferencia', v_admin),
    (v_tienda, 'b5555555-5555-5555-5555-555555555556', 'b7777777-7777-7777-7777-777777777777', 'Nómina noviembre', 900000, '2026-11-15', 'efectivo_externo', v_admin),
    (v_tienda, 'b5555555-5555-5555-5555-555555555557', null, 'Hielo', 12000, '2026-11-03', 'efectivo_externo', v_admin),
    (v_tienda, 'b5555555-5555-5555-5555-555555555557', null, 'Antes del inicio', 99000, '2026-10-20', 'efectivo_externo', v_admin);
end $$;

create temp table ids (k text primary key, v uuid);
grant all on ids to authenticated;

-- ----------------- Admin: retiro desde caja -----------------
select set_config('request.jwt.claim.sub', 'b2222222-2222-2222-2222-222222222222', true);
set local role authenticated;

insert into ids
select 'ret_caja', (public.register_owner_withdrawal_atomic(
  'b1111111-1111-1111-1111-111111111111', 200000, '2026-11-05', 'caja', 'Mercado', 'idem-ret-1')).id;

-- 1. Crea la salida de caja enlazada
select is(
  (select cm.tipo::text from public.cash_movements cm
   join public.owner_withdrawals w on w.cash_movement_id = cm.id
   where w.id = (select v from ids where k = 'ret_caja')),
  'cash_out', 'un retiro desde caja crea una salida cash_out');

-- 2. Con el motivo del retiro
select is(
  (select cm.motivo from public.cash_movements cm
   join public.owner_withdrawals w on w.cash_movement_id = cm.id
   where w.id = (select v from ids where k = 'ret_caja')),
  'Retiro de utilidad: Mercado', 'la salida de caja dice que es un retiro de utilidad');

-- 3. Idempotente: la misma clave devuelve el mismo retiro
select is(
  (public.register_owner_withdrawal_atomic(
    'b1111111-1111-1111-1111-111111111111', 200000, '2026-11-05', 'caja', 'Mercado', 'idem-ret-1')).id,
  (select v from ids where k = 'ret_caja'),
  'reintentar con la misma clave devuelve el retiro ya registrado');

select is(
  (select count(*)::int from public.cash_movements where motivo like 'Retiro de utilidad%'),
  1, 'el reintento no duplica la salida de caja');

-- 4. Retiro desde banco: no toca la caja
insert into ids
select 'ret_banco', (public.register_owner_withdrawal_atomic(
  'b1111111-1111-1111-1111-111111111111', 500000, '2026-11-10', 'banco', null, null)).id;

select is(
  (select cash_movement_id from public.owner_withdrawals where id = (select v from ids where k = 'ret_banco')),
  null, 'un retiro desde banco no crea movimiento de caja');

-- 5. Validaciones
select throws_like(
  $$ select public.register_owner_withdrawal_atomic('b1111111-1111-1111-1111-111111111111', 0, '2026-11-05', 'banco') $$,
  '%mayor a 0%', 'monto 0 rechazado');
select throws_like(
  $$ select public.register_owner_withdrawal_atomic('b1111111-1111-1111-1111-111111111111', 1000, '2026-11-05', 'bolsillo') $$,
  '%caja o banco%', 'origen inválido rechazado');

-- 6. Sin escritura directa
select throws_ok(
  $$ insert into public.owner_withdrawals (tienda_id, monto, fecha, origen, created_by)
     values ('b1111111-1111-1111-1111-111111111111', 1, '2026-11-05', 'banco', 'b2222222-2222-2222-2222-222222222222') $$,
  '42501', null, 'authenticated no puede insertar retiros directamente');

-- ----------------- Totales de los sobres -----------------
select results_eq(
  $$ select fijos_pagados_acum, variables_acum, retiros_acum, retiros_mes
     from public.get_money_envelope_totals(
       'b1111111-1111-1111-1111-111111111111',
       '2026-11-01 00:00-05', '2026-11-01 00:00-05', '2026-12-01 00:00-05', '2026-11-20 00:00-05') $$,
  $$ values (3400000::numeric, 12000::numeric, 700000::numeric, 700000::numeric) $$,
  'fijos = plantilla + nómina; día a día = hielo; retiros = caja + banco; nada anterior al inicio');

-- ----------------- Anular el retiro anula la salida de caja -----------------
select is(
  (public.void_owner_withdrawal_atomic(
    (select v from ids where k = 'ret_caja'), 'b1111111-1111-1111-1111-111111111111', 'Se registró dos veces')).status,
  'voided', 'el retiro queda anulado');

select is(
  (select cm.status::text from public.cash_movements cm
   join public.owner_withdrawals w on w.cash_movement_id = cm.id
   where w.id = (select v from ids where k = 'ret_caja')),
  'voided', 'la salida de caja del retiro también queda anulada');

select throws_like(
  $$ select public.void_owner_withdrawal_atomic(
       (select v from ids where k = 'ret_caja'), 'b1111111-1111-1111-1111-111111111111', 'Otra vez anulado') $$,
  '%ya estaba anulado%', 'no se anula dos veces');

select is(
  (select retiros_acum from public.get_money_envelope_totals(
     'b1111111-1111-1111-1111-111111111111',
     '2026-11-01 00:00-05', '2026-11-01 00:00-05', '2026-12-01 00:00-05', '2026-11-20 00:00-05')),
  500000::numeric, 'el retiro anulado deja de contar en los sobres');

-- ----------------- Anular la salida de caja anula el retiro -----------------
insert into ids
select 'ret_caja2', (public.register_owner_withdrawal_atomic(
  'b1111111-1111-1111-1111-111111111111', 50000, '2026-11-06', 'caja', null, null)).id;

select lives_ok(
  $$ select public.void_cash_movement_atomic(
       (select cash_movement_id from public.owner_withdrawals where id = (select v from ids where k = 'ret_caja2')),
       'b1111111-1111-1111-1111-111111111111', 'b2222222-2222-2222-2222-222222222222', 'Error de digitación') $$,
  'anular la salida de caja funciona');

select is(
  (select status from public.owner_withdrawals where id = (select v from ids where k = 'ret_caja2')),
  'voided', 'anular la salida de caja anula el retiro enlazado');

-- ----------------- Cajero: no puede -----------------
reset role;
select set_config('request.jwt.claim.sub', 'b3333333-3333-3333-3333-333333333333', true);
set local role authenticated;

select throws_like(
  $$ select public.register_owner_withdrawal_atomic('b1111111-1111-1111-1111-111111111111', 1000, '2026-11-05', 'banco') $$,
  '%Solo el dueño%', 'el cajero no puede registrar retiros');

reset role;

select * from finish();
rollback;
