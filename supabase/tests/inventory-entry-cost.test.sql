-- =====================================================
-- pgTAP: entrada con actualización de costo + corrección auditada
-- =====================================================
-- Requiere aplicar 20260814000100_inventory_entry_cost_correction.sql.
--   supabase test db --file supabase/tests/inventory-entry-cost.test.sql

begin;

create extension if not exists pgtap;

select plan(14);

do $$
declare
  v_tienda   uuid := 'a1111111-1111-4111-8111-111111111111';
  v_admin    uuid := 'a2222222-2222-4222-8222-222222222222';
  v_cajero   uuid := 'a2222222-2222-4222-8222-222222222223';
  v_producto uuid := 'a3333333-3333-4333-8333-333333333333';
  v_prepared uuid := 'a3333333-3333-4333-8333-333333333334';
begin
  insert into auth.users (id, email, raw_user_meta_data)
  values
    (v_admin, 'pgtap-entry-admin@local.test', '{}'::jsonb),
    (v_cajero, 'pgtap-entry-cajero@local.test', '{}'::jsonb)
  on conflict (id) do nothing;

  insert into public.tiendas (id, nombre)
  values (v_tienda, 'pgTAP costo entrada');

  insert into public.user_tiendas (user_id, tienda_id, rol, is_active)
  values
    (v_admin, v_tienda, 'admin', true),
    (v_cajero, v_tienda, 'cajero', true);

  insert into public.productos (
    id, tienda_id, nombre, tipo, precio_venta, costo, iva_tasa, stock_minimo, is_active
  )
  values
    (v_producto, v_tienda, 'Proteína prueba', 'simple', 50000, 18000, 0, 0, true),
    (v_prepared, v_tienda, 'Batido prueba', 'prepared', 15000, null, 0, 0, true);
end $$;

select set_config('request.jwt.claim.sub', 'a2222222-2222-4222-8222-222222222222', true);

select lives_ok(
  $$
    select public.register_inventory_entry_atomic(
      'a1111111-1111-4111-8111-111111111111'::uuid,
      'a3333333-3333-4333-8333-333333333333'::uuid,
      'bodega', 10, 21000, 'Compra proveedor',
      'a2222222-2222-4222-8222-222222222222'::uuid
    )
  $$,
  'admin registra entrada con costo'
);

select is(
  (select costo_unitario from public.inventory_movements
   where producto_id = 'a3333333-3333-4333-8333-333333333333'::uuid and tipo = 'entry'),
  21000::numeric,
  'la entrada conserva el costo unitario'
);

select is(
  (select costo from public.productos where id = 'a3333333-3333-4333-8333-333333333333'::uuid),
  21000::numeric,
  'registrar entrada actualiza el costo vigente del producto'
);

select is(
  (select count(*)::int from public.audit_logs
   where action = 'inventory.entry_registered'
     and entity_type = 'inventory_movement'
     and changes->>'costo_total' = '210000'),
  1,
  'la entrada deja cantidad, costo y total en auditoría'
);

select set_config('request.jwt.claim.sub', 'a2222222-2222-4222-8222-222222222223', true);

select throws_ok(
  $$
    select public.register_inventory_entry_atomic(
      'a1111111-1111-4111-8111-111111111111'::uuid,
      'a3333333-3333-4333-8333-333333333333'::uuid,
      'bodega', 1, 22000, null,
      'a2222222-2222-4222-8222-222222222223'::uuid
    )
  $$,
  'Solo el admin puede registrar entradas de inventario',
  'cajero no puede registrar entradas'
);

select set_config('request.jwt.claim.sub', 'a2222222-2222-4222-8222-222222222222', true);

select throws_ok(
  $$
    select public.register_inventory_entry_atomic(
      'a1111111-1111-4111-8111-111111111111'::uuid,
      'a3333333-3333-4333-8333-333333333334'::uuid,
      'bodega', 1, 8000, null,
      'a2222222-2222-4222-8222-222222222222'::uuid
    )
  $$,
  'Este tipo de producto no maneja inventario propio',
  'un preparado no acepta entrada propia'
);

select lives_ok(
  $$
    select public.correct_inventory_entry_cost_atomic(
      (select id from public.inventory_movements
       where producto_id = 'a3333333-3333-4333-8333-333333333333'::uuid and tipo = 'entry'),
      'a1111111-1111-4111-8111-111111111111'::uuid,
      22000, false,
      'a2222222-2222-4222-8222-222222222222'::uuid,
      'La factura tenia un costo diferente'
    )
  $$,
  'corrige el costo de entrada sin cambiar el producto'
);

select is(
  (select costo_unitario from public.inventory_movements
   where producto_id = 'a3333333-3333-4333-8333-333333333333'::uuid and tipo = 'entry'),
  22000::numeric,
  'la corrección actualiza costo_unitario'
);

select is(
  (select costo from public.productos where id = 'a3333333-3333-4333-8333-333333333333'::uuid),
  21000::numeric,
  'update_product_cost false conserva el costo vigente'
);

select is(
  (select count(*)::int from public.audit_logs
   where action = 'inventory.entry_cost_corrected'
     and (changes->>'old_unit_cost')::numeric = 21000
     and (changes->>'new_unit_cost')::numeric = 22000
     and changes->>'reason' = 'La factura tenia un costo diferente'),
  1,
  'la corrección conserva old/new/reason en auditoría'
);

select lives_ok(
  $$
    select public.correct_inventory_entry_cost_atomic(
      (select id from public.inventory_movements
       where producto_id = 'a3333333-3333-4333-8333-333333333333'::uuid and tipo = 'entry'),
      'a1111111-1111-4111-8111-111111111111'::uuid,
      23000, true,
      'a2222222-2222-4222-8222-222222222222'::uuid,
      'Costo final confirmado con el proveedor'
    )
  $$,
  'corrige la entrada y actualiza explícitamente el producto'
);

select is(
  (select costo from public.productos where id = 'a3333333-3333-4333-8333-333333333333'::uuid),
  23000::numeric,
  'update_product_cost true actualiza el costo vigente'
);

do $$
begin
  insert into public.inventory_movements (
    tienda_id, producto_id, tipo, ubicacion, cantidad, motivo, created_by
  ) values (
    'a1111111-1111-4111-8111-111111111111'::uuid,
    'a3333333-3333-4333-8333-333333333333'::uuid,
    'adjustment', 'bodega', 1, 'Conteo fisico',
    'a2222222-2222-4222-8222-222222222222'::uuid
  );
end $$;

select throws_ok(
  $$
    select public.correct_inventory_entry_cost_atomic(
      (select id from public.inventory_movements
       where producto_id = 'a3333333-3333-4333-8333-333333333333'::uuid and tipo = 'adjustment'),
      'a1111111-1111-4111-8111-111111111111'::uuid,
      24000, true,
      'a2222222-2222-4222-8222-222222222222'::uuid,
      'Intento de corregir un ajuste manual'
    )
  $$,
  'Solo se puede corregir el costo de una entrada',
  'rechaza movimientos que no son entry'
);

select throws_ok(
  $$
    select public.correct_inventory_entry_cost_atomic(
      (select id from public.inventory_movements
       where producto_id = 'a3333333-3333-4333-8333-333333333333'::uuid and tipo = 'entry'),
      'a1111111-1111-4111-8111-111111111111'::uuid,
      24000, true,
      'a2222222-2222-4222-8222-222222222222'::uuid,
      'corto'
    )
  $$,
  'El motivo debe tener al menos 10 caracteres',
  'rechaza motivo de corrección corto'
);

select * from finish();

rollback;
