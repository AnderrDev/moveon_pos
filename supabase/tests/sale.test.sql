-- =====================================================
-- pgTAP: create_sale_atomic & void_sale_atomic
-- =====================================================
-- Cómo correr (requiere Supabase CLI + Docker):
--   supabase test db --file supabase/tests/sale.test.sql
--
-- pgTAP no está instalado por defecto en proyectos Supabase.
-- Si la primera ejecución falla con "extension pgtap not found":
--   psql "$SUPABASE_DB_URL" -c "create extension if not exists pgtap"
-- =====================================================

begin;

create extension if not exists pgtap;

select plan(8);

-- ----------------- Setup -----------------
-- Datos aislados con UUIDs determinísticos para que la transacción rollback
-- al final no contamine el resto del esquema.

do $$
declare
  v_tienda_id    uuid := '11111111-1111-1111-1111-111111111111';
  v_user_id      uuid := '22222222-2222-2222-2222-222222222222';
  v_session_id   uuid := '33333333-3333-3333-3333-333333333333';
  v_categoria    uuid := '44444444-4444-4444-4444-444444444444';
  v_producto     uuid := '55555555-5555-5555-5555-555555555555';
begin
  insert into auth.users (id, email, raw_user_meta_data)
  values (v_user_id, 'pgtap@local.test', '{}'::jsonb)
  on conflict (id) do nothing;

  insert into public.tiendas (id, nombre)
  values (v_tienda_id, 'pgTAP Tienda');

  insert into public.user_tiendas (user_id, tienda_id, rol, is_active)
  values (v_user_id, v_tienda_id, 'admin', true);

  insert into public.cash_sessions (id, tienda_id, opened_by, opening_amount, status)
  values (v_session_id, v_tienda_id, v_user_id, 100000, 'open');

  insert into public.categorias (id, tienda_id, nombre)
  values (v_categoria, v_tienda_id, 'pgTAP Cat');

  insert into public.productos (id, tienda_id, categoria_id, nombre, precio_venta, iva_tasa, stock_minimo, is_active)
  values (v_producto, v_tienda_id, v_categoria, 'Producto pgTAP', 5000, 0, 0, true);

  -- Stock inicial = 10
  insert into public.inventory_movements (tienda_id, producto_id, tipo, cantidad, created_by)
  values (v_tienda_id, v_producto, 'entry', 10, v_user_id);
end $$;

-- ----------------- Tests -----------------

-- 1. Venta básica retorna un UUID
prepare crear_venta_basica as
  select public.create_sale_atomic(
    '11111111-1111-1111-1111-111111111111'::uuid,
    '33333333-3333-3333-3333-333333333333'::uuid,
    'TST-001',
    '22222222-2222-2222-2222-222222222222'::uuid,
    null,
    5000, 0, 0, 5000,
    'idem-key-1',
    jsonb_build_array(jsonb_build_object(
      'producto_id', '55555555-5555-5555-5555-555555555555',
      'producto_nombre', 'Producto pgTAP',
      'producto_sku', null,
      'quantity', 1,
      'unit_price', 5000,
      'discount_amount', 0,
      'tax_rate', 0,
      'tax_amount', 0,
      'total', 5000
    )),
    jsonb_build_array(jsonb_build_object('metodo', 'cash', 'amount', 5000))
  );

select isnt(execute('crear_venta_basica')::text, '', 'create_sale_atomic retorna un UUID no vacío');

-- 2. La venta queda persistida con status completed
select is(
  (select status::text from public.sales where idempotency_key = 'idem-key-1'),
  'completed',
  'la venta queda en status completed'
);

-- 3. Idempotencia: misma key devuelve mismo id
select is(
  public.create_sale_atomic(
    '11111111-1111-1111-1111-111111111111'::uuid,
    '33333333-3333-3333-3333-333333333333'::uuid,
    'TST-001-DUP',
    '22222222-2222-2222-2222-222222222222'::uuid,
    null,
    5000, 0, 0, 5000,
    'idem-key-1',
    jsonb_build_array(jsonb_build_object(
      'producto_id', '55555555-5555-5555-5555-555555555555',
      'producto_nombre', 'Producto pgTAP',
      'producto_sku', null,
      'quantity', 1,
      'unit_price', 5000,
      'discount_amount', 0,
      'tax_rate', 0,
      'tax_amount', 0,
      'total', 5000
    )),
    jsonb_build_array(jsonb_build_object('metodo', 'cash', 'amount', 5000))
  ),
  (select id from public.sales where idempotency_key = 'idem-key-1'),
  'idempotencia: misma key devuelve la misma venta'
);

-- 4. Stock descontado por sale_exit
select is(
  public.get_stock(
    '55555555-5555-5555-5555-555555555555'::uuid,
    '11111111-1111-1111-1111-111111111111'::uuid
  ),
  9::numeric,
  'stock baja a 9 después de la venta'
);

-- 5. Pagos < total falla
select throws_ok(
  $$
    select public.create_sale_atomic(
      '11111111-1111-1111-1111-111111111111'::uuid,
      '33333333-3333-3333-3333-333333333333'::uuid,
      'TST-002',
      '22222222-2222-2222-2222-222222222222'::uuid,
      null,
      5000, 0, 0, 5000,
      'idem-key-2',
      jsonb_build_array(jsonb_build_object(
        'producto_id', '55555555-5555-5555-5555-555555555555',
        'producto_nombre', 'Producto pgTAP',
        'producto_sku', null,
        'quantity', 1,
        'unit_price', 5000,
        'discount_amount', 0,
        'tax_rate', 0,
        'tax_amount', 0,
        'total', 5000
      )),
      jsonb_build_array(jsonb_build_object('metodo', 'cash', 'amount', 1000))
    )
  $$,
  'La suma de pagos no cubre el total de la venta'
);

-- 6. Stock insuficiente falla
select throws_ok(
  $$
    select public.create_sale_atomic(
      '11111111-1111-1111-1111-111111111111'::uuid,
      '33333333-3333-3333-3333-333333333333'::uuid,
      'TST-003',
      '22222222-2222-2222-2222-222222222222'::uuid,
      null,
      500000, 0, 0, 500000,
      'idem-key-3',
      jsonb_build_array(jsonb_build_object(
        'producto_id', '55555555-5555-5555-5555-555555555555',
        'producto_nombre', 'Producto pgTAP',
        'producto_sku', null,
        'quantity', 100,
        'unit_price', 5000,
        'discount_amount', 0,
        'tax_rate', 0,
        'tax_amount', 0,
        'total', 500000
      )),
      jsonb_build_array(jsonb_build_object('metodo', 'cash', 'amount', 500000))
    )
  $$,
  'Stock insuficiente'
);

-- 7. Cambio sólo desde efectivo (pagos no efectivo > total falla)
select throws_ok(
  $$
    select public.create_sale_atomic(
      '11111111-1111-1111-1111-111111111111'::uuid,
      '33333333-3333-3333-3333-333333333333'::uuid,
      'TST-004',
      '22222222-2222-2222-2222-222222222222'::uuid,
      null,
      5000, 0, 0, 5000,
      'idem-key-4',
      jsonb_build_array(jsonb_build_object(
        'producto_id', '55555555-5555-5555-5555-555555555555',
        'producto_nombre', 'Producto pgTAP',
        'producto_sku', null,
        'quantity', 1,
        'unit_price', 5000,
        'discount_amount', 0,
        'tax_rate', 0,
        'tax_amount', 0,
        'total', 5000
      )),
      jsonb_build_array(jsonb_build_object('metodo', 'card', 'amount', 6000))
    )
  $$,
  'El cambio solo puede generarse desde pagos en efectivo'
);

-- 8. Caja cerrada: nueva venta falla
do $$
begin
  update public.cash_sessions
  set status = 'closed', closed_at = now()
  where id = '33333333-3333-3333-3333-333333333333';
end $$;

select throws_ok(
  $$
    select public.create_sale_atomic(
      '11111111-1111-1111-1111-111111111111'::uuid,
      '33333333-3333-3333-3333-333333333333'::uuid,
      'TST-005',
      '22222222-2222-2222-2222-222222222222'::uuid,
      null,
      5000, 0, 0, 5000,
      'idem-key-5',
      jsonb_build_array(jsonb_build_object(
        'producto_id', '55555555-5555-5555-5555-555555555555',
        'producto_nombre', 'Producto pgTAP',
        'producto_sku', null,
        'quantity', 1,
        'unit_price', 5000,
        'discount_amount', 0,
        'tax_rate', 0,
        'tax_amount', 0,
        'total', 5000
      )),
      jsonb_build_array(jsonb_build_object('metodo', 'cash', 'amount', 5000))
    )
  $$,
  'No hay caja abierta para esta venta'
);

select * from finish();

rollback;
