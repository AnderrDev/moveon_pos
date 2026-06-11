-- =====================================================
-- pgTAP: inventario por ubicación (PLAN-23)
-- =====================================================
-- Cómo correr (requiere Supabase CLI + Docker):
--   supabase test db --file supabase/tests/inventory-locations.test.sql
-- =====================================================

begin;

create extension if not exists pgtap;

select plan(7);

do $$
declare
  v_tienda_id uuid := 'e1111111-1111-1111-1111-111111111111';
  v_admin     uuid := 'e2222222-2222-2222-2222-222222222222';
  v_cajero    uuid := 'e2222222-2222-2222-2222-222222222223';
  v_categoria uuid := 'e4444444-4444-4444-4444-444444444444';
  v_producto  uuid := 'e5555555-5555-5555-5555-555555555555';
begin
  insert into auth.users (id, email, raw_user_meta_data)
  values (v_admin, 'pgtap-inv-admin@local.test', '{}'::jsonb),
         (v_cajero, 'pgtap-inv-cajero@local.test', '{}'::jsonb)
  on conflict (id) do nothing;

  insert into public.tiendas (id, nombre)
  values (v_tienda_id, 'pgTAP Inventario Ubicaciones');

  insert into public.user_tiendas (user_id, tienda_id, rol, is_active)
  values (v_admin, v_tienda_id, 'admin', true),
         (v_cajero, v_tienda_id, 'cajero', true);

  insert into public.categorias (id, tienda_id, nombre)
  values (v_categoria, v_tienda_id, 'pgTAP Cat');

  insert into public.productos (id, tienda_id, categoria_id, nombre, precio_venta, iva_tasa, stock_minimo, is_active)
  values (v_producto, v_tienda_id, v_categoria, 'Producto Ubicacion', 5000, 0, 0, true);

  insert into public.inventory_movements (tienda_id, producto_id, tipo, ubicacion, cantidad, created_by)
  values (v_tienda_id, v_producto, 'entry', 'punto_venta', 2, v_admin),
         (v_tienda_id, v_producto, 'entry', 'bodega', 5, v_admin);
end $$;

select is(
  public.get_stock(
    'e5555555-5555-5555-5555-555555555555'::uuid,
    'e1111111-1111-1111-1111-111111111111'::uuid,
    'punto_venta'
  ),
  2::numeric,
  'get_stock filtra punto_venta'
);

select is(
  public.get_stock(
    'e5555555-5555-5555-5555-555555555555'::uuid,
    'e1111111-1111-1111-1111-111111111111'::uuid,
    'bodega'
  ),
  5::numeric,
  'get_stock filtra bodega'
);

select set_config('request.jwt.claim.sub', 'e2222222-2222-2222-2222-222222222222', true);

select lives_ok(
  $$
    select public.transfer_stock_atomic(
      'e1111111-1111-1111-1111-111111111111'::uuid,
      'e5555555-5555-5555-5555-555555555555'::uuid,
      'bodega',
      'punto_venta',
      3,
      'Reposicion mostrador',
      'e2222222-2222-2222-2222-222222222222'::uuid
    )
  $$,
  'admin traslada bodega a punto_venta'
);

select is(
  public.get_stock(
    'e5555555-5555-5555-5555-555555555555'::uuid,
    'e1111111-1111-1111-1111-111111111111'::uuid,
    'punto_venta'
  ),
  5::numeric,
  'el traslado suma en punto_venta'
);

select results_eq(
  $$
    select tipo::text, ubicacion::text, cantidad
    from public.inventory_movements
    where referencia_tipo = 'transfer'
      and producto_id = 'e5555555-5555-5555-5555-555555555555'::uuid
    order by tipo
  $$,
  $$ values ('transfer_in', 'punto_venta', 3::numeric),
            ('transfer_out', 'bodega', -3::numeric) $$,
  'el traslado crea transfer_out y transfer_in con ubicaciones'
);

select throws_ok(
  $$
    select public.transfer_stock_atomic(
      'e1111111-1111-1111-1111-111111111111'::uuid,
      'e5555555-5555-5555-5555-555555555555'::uuid,
      'bodega',
      'punto_venta',
      99,
      'Reposicion mostrador',
      'e2222222-2222-2222-2222-222222222222'::uuid
    )
  $$,
  'Stock insuficiente para traslado',
  'no permite dejar negativo el origen'
);

select set_config('request.jwt.claim.sub', 'e2222222-2222-2222-2222-222222222223', true);

select throws_ok(
  $$
    select public.transfer_stock_atomic(
      'e1111111-1111-1111-1111-111111111111'::uuid,
      'e5555555-5555-5555-5555-555555555555'::uuid,
      'bodega',
      'punto_venta',
      1,
      'Reposicion mostrador',
      'e2222222-2222-2222-2222-222222222223'::uuid
    )
  $$,
  'Solo el admin puede trasladar inventario',
  'cajero no puede trasladar inventario'
);

select * from finish();

rollback;
