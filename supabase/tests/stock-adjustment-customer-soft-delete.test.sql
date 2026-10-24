-- =====================================================
-- pgTAP: ajustes de stock por RPC + borrado lógico de clientes
-- =====================================================
-- Requiere 20261024000400 y 20261024000500.
--   supabase test db --local supabase/tests/stock-adjustment-customer-soft-delete.test.sql
-- Se ejecuta como `authenticated` (lo que usa el cliente con su JWT).

begin;

create extension if not exists pgtap;

select plan(23);

do $$
declare
  v_tienda uuid := 'c1111111-1111-4111-8111-111111111111';
  v_admin  uuid := 'c2222222-2222-4222-8222-222222222221';
  v_cajero uuid := 'c2222222-2222-4222-8222-222222222222';
begin
  insert into auth.users (id, email, raw_user_meta_data) values
    (v_admin,  'pgtap-soft-admin@local.test',  '{}'::jsonb),
    (v_cajero, 'pgtap-soft-cajero@local.test', '{}'::jsonb)
  on conflict (id) do nothing;

  insert into public.tiendas (id, nombre) values (v_tienda, 'pgTAP soft delete');

  insert into public.user_tiendas (user_id, tienda_id, rol, is_active) values
    (v_admin,  v_tienda, 'admin',  true),
    (v_cajero, v_tienda, 'cajero', true);

  insert into public.productos (
    id, tienda_id, nombre, tipo, precio_venta, costo, iva_tasa, stock_minimo, is_active
  ) values
    ('c3333333-3333-4333-8333-333333333331', v_tienda, 'pgTAP whey', 'simple', 90000, 50000, 0, 0, true),
    ('c3333333-3333-4333-8333-333333333332', v_tienda, 'pgTAP batido', 'prepared', 15000, null, 0, 0, true);

  insert into public.inventory_movements (tienda_id, producto_id, tipo, ubicacion, cantidad, created_by)
  values (v_tienda, 'c3333333-3333-4333-8333-333333333331', 'entry', 'punto_venta', 10, v_admin);

  insert into public.clientes (
    id, tienda_id, nombre, tipo_documento, numero_documento, telefono, celular_normalizado,
    autoriza_fidelizacion
  ) values (
    'c4444444-4444-4444-8444-444444444441', v_tienda, 'Cliente pgTAP', 'CC', '900111222',
    '3001112233', '3001112233', true
  );

  insert into public.loyalty_accounts (tienda_id, cliente_id, stamps_balance)
  values (v_tienda, 'c4444444-4444-4444-8444-444444444441', 3);

  insert into public.cash_sessions (id, tienda_id, opened_by, opening_amount, status)
  values ('c5555555-5555-4555-8555-555555555551', v_tienda, v_cajero, 0, 'open');
end $$;

-- ── Admin: ajustes de stock ─────────────────────────────────────────────
select set_config('request.jwt.claim.sub', 'c2222222-2222-4222-8222-222222222221', true);
set local role authenticated;

select throws_ok(
  $$ insert into public.inventory_movements (tienda_id, producto_id, tipo, ubicacion, cantidad, motivo, created_by)
     values ('c1111111-1111-4111-8111-111111111111', 'c3333333-3333-4333-8333-333333333331',
             'adjustment', 'punto_venta', -1, 'directo', 'c2222222-2222-4222-8222-222222222221') $$,
  '42501', null, 'ni el admin inserta movimientos de inventario directo'
);

select throws_ok(
  $$ update public.inventory_movements set cantidad = 999
     where producto_id = 'c3333333-3333-4333-8333-333333333331' $$,
  '42501', null, 'nadie modifica movimientos de inventario'
);

select throws_ok(
  $$ delete from public.inventory_movements
     where producto_id = 'c3333333-3333-4333-8333-333333333331' $$,
  '42501', null, 'nadie borra movimientos de inventario'
);

select lives_ok(
  $$ select public.adjust_stock_atomic(
       'c1111111-1111-4111-8111-111111111111', 'c3333333-3333-4333-8333-333333333331',
       'punto_venta', -2, 'Conteo físico: 2 tarros dañados',
       'c2222222-2222-4222-8222-222222222221') $$,
  'admin ajusta stock vía RPC'
);

select is(
  (select sum(cantidad)::int from public.inventory_movements
   where producto_id = 'c3333333-3333-4333-8333-333333333331' and ubicacion = 'punto_venta'),
  8, 'el ajuste se refleja en el stock'
);

select is(
  (select count(*)::int from public.audit_logs
   where action = 'inventory.adjusted'
     and entity_id = 'c3333333-3333-4333-8333-333333333331'),
  1, 'el ajuste queda auditado por el trigger'
);

select throws_ok(
  $$ select public.adjust_stock_atomic(
       'c1111111-1111-4111-8111-111111111111', 'c3333333-3333-4333-8333-333333333331',
       'punto_venta', 0, 'Sin cambio', 'c2222222-2222-4222-8222-222222222221') $$,
  'El ajuste no puede ser cero', 'rechaza ajuste en cero'
);

select throws_ok(
  $$ select public.adjust_stock_atomic(
       'c1111111-1111-4111-8111-111111111111', 'c3333333-3333-4333-8333-333333333331',
       'punto_venta', 1, 'x', 'c2222222-2222-4222-8222-222222222221') $$,
  'El motivo debe tener entre 3 y 200 caracteres', 'rechaza motivo corto'
);

select throws_ok(
  $$ select public.adjust_stock_atomic(
       'c1111111-1111-4111-8111-111111111111', 'c3333333-3333-4333-8333-333333333332',
       'punto_venta', 1, 'Preparado', 'c2222222-2222-4222-8222-222222222221') $$,
  'Este tipo de producto no maneja inventario propio', 'un preparado no se ajusta'
);

select throws_ok(
  $$ select public.adjust_stock_atomic(
       'c1111111-1111-4111-8111-111111111111', 'c3333333-3333-4333-8333-333333333331',
       'punto_venta', 1, 'Suplantación', 'c2222222-2222-4222-8222-222222222222') $$,
  'No autenticado', 'no se ajusta a nombre de otro usuario'
);

-- ── Cajero ──────────────────────────────────────────────────────────────
select set_config('request.jwt.claim.sub', 'c2222222-2222-4222-8222-222222222222', true);

select throws_ok(
  $$ select public.adjust_stock_atomic(
       'c1111111-1111-4111-8111-111111111111', 'c3333333-3333-4333-8333-333333333331',
       'punto_venta', 5, 'Cajero intenta ajustar', 'c2222222-2222-4222-8222-222222222222') $$,
  'Solo el admin puede ajustar inventario', 'cajero no puede ajustar stock'
);

select throws_ok(
  $$ delete from public.clientes where id = 'c4444444-4444-4444-8444-444444444441' $$,
  '42501', null, 'nadie borra clientes físicamente'
);

select throws_ok(
  $$ update public.clientes set deleted_at = now() where id = 'c4444444-4444-4444-8444-444444444441' $$,
  '42501', null, 'el cliente no puede marcar deleted_at directo'
);

select lives_ok(
  $$ update public.clientes set nombre = 'Cliente pgTAP editado'
     where id = 'c4444444-4444-4444-8444-444444444441' $$,
  'la edición normal del cliente sigue funcionando'
);

select lives_ok(
  $$ select public.delete_customer_atomic(
       'c4444444-4444-4444-8444-444444444441', 'c1111111-1111-4111-8111-111111111111',
       'c2222222-2222-4222-8222-222222222222') $$,
  'cajero elimina un cliente vía RPC'
);

select is(
  (select (deleted_at is not null and deleted_by = 'c2222222-2222-4222-8222-222222222222'::uuid and not activo)
   from public.clientes where id = 'c4444444-4444-4444-8444-444444444441'),
  true, 'el borrado es lógico: deleted_at, deleted_by y activo = false'
);

select is(
  (select stamps_balance::int from public.loyalty_accounts
   where cliente_id = 'c4444444-4444-4444-8444-444444444441'),
  3, 'el historial de fidelización se conserva'
);

select is(
  (select count(*)::int from public.audit_logs
   where action = 'customer.deleted' and entity_id = 'c4444444-4444-4444-8444-444444444441'),
  1, 'el borrado queda auditado'
);

select throws_ok(
  $$ select public.delete_customer_atomic(
       'c4444444-4444-4444-8444-444444444441', 'c1111111-1111-4111-8111-111111111111',
       'c2222222-2222-4222-8222-222222222222') $$,
  'Cliente no encontrado', 'no se elimina dos veces'
);

select lives_ok(
  $$ insert into public.clientes (tienda_id, nombre, tipo_documento, numero_documento, telefono, celular_normalizado)
     values ('c1111111-1111-4111-8111-111111111111', 'Cliente nuevo', 'CC', '900111222',
             '3001112233', '3001112233') $$,
  'el celular y documento de un cliente eliminado se pueden reutilizar'
);

select throws_ok(
  $$ insert into public.clientes (tienda_id, nombre, tipo_documento, numero_documento)
     values ('c1111111-1111-4111-8111-111111111111', 'Duplicado', 'CC', '900111222') $$,
  '23505', null, 'la unicidad sigue aplicando entre clientes vigentes'
);

select throws_ok(
  $$ select public.create_sale_atomic(
       'c1111111-1111-4111-8111-111111111111', 'c5555555-5555-4555-8555-555555555551', '',
       'c2222222-2222-4222-8222-222222222222', 'c4444444-4444-4444-8444-444444444441',
       90000, 0, 0, 90000, 'pgtap-soft-sale',
       '[{"producto_id":"c3333333-3333-4333-8333-333333333331","producto_nombre":"pgTAP whey",
          "producto_sku":null,"quantity":1,"unit_price":90000,"option_id":null,
          "discount_amount":0,"tax_rate":0,"tax_amount":0,"total":90000}]'::jsonb,
       '[{"metodo":"cash","amount":90000,"referencia":null}]'::jsonb,
       0, null, '[]'::jsonb) $$,
  'El cliente fue eliminado', 'no se venden a un cliente eliminado'
);

select is(
  (select count(*)::int from public.clientes
   where tienda_id = 'c1111111-1111-4111-8111-111111111111' and deleted_at is null),
  1, 'solo el cliente nuevo aparece como vigente'
);

select * from finish();

rollback;
