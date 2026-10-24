-- =====================================================
-- pgTAP: auditoría completa (2026-10-24)
-- =====================================================
--   supabase test db --local supabase/tests/audit-logs-enrichment.test.sql
-- =====================================================

begin;

create extension if not exists pgtap;

select plan(10);

do $$
declare
  v_tienda uuid := 'b1111111-1111-1111-1111-111111111111';
  v_admin  uuid := 'b2222222-2222-2222-2222-222222222222';
begin
  insert into auth.users (id, email, raw_user_meta_data)
  values (v_admin, 'audit-admin@local.test', '{}'::jsonb)
  on conflict (id) do nothing;

  insert into public.tiendas (id, nombre, timezone) values (v_tienda, 'pgTAP Auditoría', 'America/Bogota');
  insert into public.user_tiendas (user_id, tienda_id, rol, is_active) values (v_admin, v_tienda, 'admin', true);
  insert into public.cash_sessions (id, tienda_id, opened_by, opening_amount, status)
  values ('b4444444-4444-4444-4444-444444444444', v_tienda, v_admin, 50000, 'open');
  insert into public.expense_categories (id, tienda_id, nombre, slug, tipo)
  values ('b5555555-5555-5555-5555-555555555555', v_tienda, 'Servicios', 'servicios', 'fijo');
  insert into public.productos (id, tienda_id, nombre, tipo, precio_venta, costo, iva_tasa, stock_minimo, is_active)
  values ('b6666666-6666-6666-6666-666666666666', v_tienda, 'Creatina Auditoría', 'simple', 80000, 40000, 0, 0, true);
end $$;

create temp table ids (k text primary key, v uuid);
grant all on ids to authenticated;

select set_config('request.jwt.claim.sub', 'b2222222-2222-2222-2222-222222222222', true);
set local role authenticated;

-- Movimiento de caja anulado: la RPC no manda correo ni nombre.
insert into ids
select 'mov', (public.add_cash_movement_atomic(
  'b4444444-4444-4444-4444-444444444444', 'cash_out', 5000, 'Retiro para cambio',
  'b2222222-2222-2222-2222-222222222222')).id;
select public.void_cash_movement_atomic(
  (select v from ids where k = 'mov'), 'b1111111-1111-1111-1111-111111111111',
  'b2222222-2222-2222-2222-222222222222', 'Registrado dos veces');

-- 1-2. El trigger completa correo y nombre
select is(
  (select user_email from public.audit_logs where action = 'cash_movement.voided' and entity_id = (select v from ids where k = 'mov')),
  'audit-admin@local.test', 'un registro de la base recibe el correo del usuario');
select is(
  (select entity_label from public.audit_logs where action = 'cash_movement.voided' and entity_id = (select v from ids where k = 'mov')),
  'Retiro para cambio', 'y el nombre de la entidad (motivo del movimiento)');

-- 3. Registro de la app sin nombre: el trigger lo resuelve
insert into public.audit_logs (tienda_id, user_id, user_email, entity_type, entity_id, action, changes)
values ('b1111111-1111-1111-1111-111111111111', 'b2222222-2222-2222-2222-222222222222', 'audit-admin@local.test',
        'producto', 'b6666666-6666-6666-6666-666666666666', 'update', '{"nombre": {"from": "A", "to": "B"}}');
select is(
  (select entity_label from public.audit_logs where action = 'update' and entity_id = 'b6666666-6666-6666-6666-666666666666'),
  'Creatina Auditoría', 'un registro de la app sin nombre recibe el del producto');

-- 4. Un nombre explícito no se pisa
insert into public.audit_logs (tienda_id, user_id, user_email, entity_type, entity_id, entity_label, action)
values ('b1111111-1111-1111-1111-111111111111', 'b2222222-2222-2222-2222-222222222222', 'audit-admin@local.test',
        'producto', 'b6666666-6666-6666-6666-666666666666', 'Nombre explícito', 'deactivate');
select is(
  (select entity_label from public.audit_logs where action = 'deactivate' and entity_id = 'b6666666-6666-6666-6666-666666666666'),
  'Nombre explícito', 'el nombre enviado por el cliente se respeta');

-- 5. La caja se nombra con su fecha de apertura
reset role;
select matches(
  public.audit_entity_label('cash_session', 'b4444444-4444-4444-4444-444444444444'),
  '^Caja del \d{2}/\d{2}/\d{4} \d{2}:\d{2}$', 'la caja se nombra con su fecha de apertura');
set local role authenticated;

-- 6. Crear un gasto queda auditado con su detalle
insert into ids
select 'exp', (public.register_expense_atomic(
  'b1111111-1111-1111-1111-111111111111', 'b5555555-5555-5555-5555-555555555555',
  'Internet octubre', 90000, 'transferencia')).id;
select is(
  (select row(entity_label, metadata->>'categoria', (metadata->>'monto')::numeric, metadata->>'metodo_pago', user_email)::text
   from public.audit_logs where action = 'expense.created' and entity_id = (select v from ids where k = 'exp')),
  row('Internet octubre'::text, 'Servicios'::text, 90000.00::numeric, 'transferencia'::text, 'audit-admin@local.test'::text)::text,
  'crear un gasto deja expense.created con categoría, monto, método y usuario');

-- 7. El ajuste de stock registra la ubicación y el producto
select public.adjust_stock_atomic(
  'b1111111-1111-1111-1111-111111111111', 'b6666666-6666-6666-6666-666666666666',
  'punto_venta', 3, 'Conteo físico', 'b2222222-2222-2222-2222-222222222222');
select is(
  (select row(metadata->>'ubicacion', entity_label)::text from public.audit_logs
   where action = 'inventory.adjusted' and entity_id = 'b6666666-6666-6666-6666-666666666666'),
  row('punto_venta'::text, 'Creatina Auditoría'::text)::text,
  'el ajuste registra ubicación y nombre del producto');

-- 8. audit_entity_label no es invocable por el cliente
select throws_ok(
  $$ select public.audit_entity_label('producto', 'b6666666-6666-6666-6666-666666666666') $$,
  '42501', null, 'authenticated no puede llamar audit_entity_label');

-- 9. Un cliente no puede registrar a nombre de otro usuario (la política se mantiene)
select throws_ok(
  $$ insert into public.audit_logs (tienda_id, user_id, action)
     values ('b1111111-1111-1111-1111-111111111111', 'a2222222-2222-2222-2222-222222222222', 'x') $$,
  '42501', null, 'no se puede auditar a nombre de otro usuario');

-- 10. El cierre de caja registra la nota, la base y el efectivo esperado
select public.close_cash_session_atomic(
  'b4444444-4444-4444-4444-444444444444', 'b1111111-1111-1111-1111-111111111111',
  'b2222222-2222-2222-2222-222222222222', 30000, 0, '[]'::jsonb, 'Faltaron 20.000 del retiro');
select is(
  (select row(metadata->>'notas_cierre', (metadata->>'opening_amount')::numeric, (metadata->>'expected_cash_amount')::numeric, entity_label like 'Caja del %')::text
   from public.audit_logs where action = 'cash_session.closed' and entity_id = 'b4444444-4444-4444-4444-444444444444'),
  row('Faltaron 20.000 del retiro'::text, 50000.00::numeric, 50000.00::numeric, true)::text,
  'el cierre guarda nota, base, efectivo esperado y nombre de la caja');

select * from finish();

rollback;
