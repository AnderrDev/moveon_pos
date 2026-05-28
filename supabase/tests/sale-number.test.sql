-- =====================================================
-- pgTAP: sale_number correlativo por tienda (PLAN-03)
-- =====================================================
-- Cómo correr (requiere Supabase CLI + Docker):
--   supabase test db --file supabase/tests/sale-number.test.sql
--
-- pgTAP no está instalado por defecto en proyectos Supabase.
-- Si la primera ejecución falla con "extension pgtap not found":
--   psql "$SUPABASE_DB_URL" -c "create extension if not exists pgtap"
--
-- Nota: corre dentro de una transacción con rollback. sale_counters arranca
-- vacío para estas tiendas, así que el primer upsert inserta last_number = 1
-- (RETURNING) y produce 'V-000001'. La transacción se revierte al final, sin
-- contaminar el esquema.
-- =====================================================

begin;

create extension if not exists pgtap;

select plan(7);

-- ----------------- Setup -----------------
-- Tienda A (operación principal) y Tienda B (aislamiento) con datos propios.

do $$
declare
  -- Tienda A
  v_tienda_a   uuid := 'a1111111-1111-1111-1111-111111111111';
  v_user_a     uuid := 'a2222222-2222-2222-2222-222222222222';
  v_session_a  uuid := 'a3333333-3333-3333-3333-333333333333';
  v_cat_a      uuid := 'a4444444-4444-4444-4444-444444444444';
  v_prod_a     uuid := 'a5555555-5555-5555-5555-555555555555';
  -- Tienda B
  v_tienda_b   uuid := 'b1111111-1111-1111-1111-111111111111';
  v_user_b     uuid := 'b2222222-2222-2222-2222-222222222222';
  v_session_b  uuid := 'b3333333-3333-3333-3333-333333333333';
  v_cat_b      uuid := 'b4444444-4444-4444-4444-444444444444';
  v_prod_b     uuid := 'b5555555-5555-5555-5555-555555555555';
begin
  -- Tienda A
  insert into auth.users (id, email, raw_user_meta_data)
  values (v_user_a, 'pgtap-a@local.test', '{}'::jsonb)
  on conflict (id) do nothing;

  insert into public.tiendas (id, nombre)
  values (v_tienda_a, 'pgTAP Tienda A');

  insert into public.user_tiendas (user_id, tienda_id, rol, is_active)
  values (v_user_a, v_tienda_a, 'admin', true);

  insert into public.cash_sessions (id, tienda_id, opened_by, opening_amount, status)
  values (v_session_a, v_tienda_a, v_user_a, 100000, 'open');

  insert into public.categorias (id, tienda_id, nombre)
  values (v_cat_a, v_tienda_a, 'pgTAP Cat A');

  insert into public.productos (id, tienda_id, categoria_id, nombre, precio_venta, iva_tasa, stock_minimo, is_active)
  values (v_prod_a, v_tienda_a, v_cat_a, 'Producto A', 5000, 0, 0, true);

  insert into public.inventory_movements (tienda_id, producto_id, tipo, cantidad, created_by)
  values (v_tienda_a, v_prod_a, 'entry', 100, v_user_a);

  -- Tienda B
  insert into auth.users (id, email, raw_user_meta_data)
  values (v_user_b, 'pgtap-b@local.test', '{}'::jsonb)
  on conflict (id) do nothing;

  insert into public.tiendas (id, nombre)
  values (v_tienda_b, 'pgTAP Tienda B');

  insert into public.user_tiendas (user_id, tienda_id, rol, is_active)
  values (v_user_b, v_tienda_b, 'admin', true);

  insert into public.cash_sessions (id, tienda_id, opened_by, opening_amount, status)
  values (v_session_b, v_tienda_b, v_user_b, 100000, 'open');

  insert into public.categorias (id, tienda_id, nombre)
  values (v_cat_b, v_tienda_b, 'pgTAP Cat B');

  insert into public.productos (id, tienda_id, categoria_id, nombre, precio_venta, iva_tasa, stock_minimo, is_active)
  values (v_prod_b, v_tienda_b, v_cat_b, 'Producto B', 5000, 0, 0, true);

  insert into public.inventory_movements (tienda_id, producto_id, tipo, cantidad, created_by)
  values (v_tienda_b, v_prod_b, 'entry', 100, v_user_b);

  -- ----------------- Ejecución -----------------
  -- 3 ventas en tienda A (idempotency keys distintas).
  perform public.create_sale_atomic(
    v_tienda_a, v_session_a, '', v_user_a, null,
    5000, 0, 0, 5000, 'a-idem-1',
    jsonb_build_array(jsonb_build_object(
      'producto_id', v_prod_a, 'producto_nombre', 'Producto A', 'producto_sku', null,
      'quantity', 1, 'unit_price', 5000, 'discount_amount', 0,
      'tax_rate', 0, 'tax_amount', 0, 'total', 5000)),
    jsonb_build_array(jsonb_build_object('metodo', 'cash', 'amount', 5000)));

  perform public.create_sale_atomic(
    v_tienda_a, v_session_a, '', v_user_a, null,
    5000, 0, 0, 5000, 'a-idem-2',
    jsonb_build_array(jsonb_build_object(
      'producto_id', v_prod_a, 'producto_nombre', 'Producto A', 'producto_sku', null,
      'quantity', 1, 'unit_price', 5000, 'discount_amount', 0,
      'tax_rate', 0, 'tax_amount', 0, 'total', 5000)),
    jsonb_build_array(jsonb_build_object('metodo', 'cash', 'amount', 5000)));

  perform public.create_sale_atomic(
    v_tienda_a, v_session_a, '', v_user_a, null,
    5000, 0, 0, 5000, 'a-idem-3',
    jsonb_build_array(jsonb_build_object(
      'producto_id', v_prod_a, 'producto_nombre', 'Producto A', 'producto_sku', null,
      'quantity', 1, 'unit_price', 5000, 'discount_amount', 0,
      'tax_rate', 0, 'tax_amount', 0, 'total', 5000)),
    jsonb_build_array(jsonb_build_object('metodo', 'cash', 'amount', 5000)));

  -- 1 venta en tienda B (aislamiento).
  perform public.create_sale_atomic(
    v_tienda_b, v_session_b, '', v_user_b, null,
    5000, 0, 0, 5000, 'b-idem-1',
    jsonb_build_array(jsonb_build_object(
      'producto_id', v_prod_b, 'producto_nombre', 'Producto B', 'producto_sku', null,
      'quantity', 1, 'unit_price', 5000, 'discount_amount', 0,
      'tax_rate', 0, 'tax_amount', 0, 'total', 5000)),
    jsonb_build_array(jsonb_build_object('metodo', 'cash', 'amount', 5000)));
end $$;

-- ----------------- Tests -----------------

-- 1. Consecutivo dentro de tienda A: V-000001, V-000002, V-000003.
select results_eq(
  $$
    select sale_number
    from public.sales
    where tienda_id = 'a1111111-1111-1111-1111-111111111111'::uuid
    order by created_at, sale_number
  $$,
  $$ values ('V-000001'), ('V-000002'), ('V-000003') $$,
  'tienda A emite V-000001..V-000003 consecutivos'
);

-- 2. Estrictamente creciente: el mínimo < máximo y son 3 distintos ordenados.
select is(
  (select count(*)::int
   from (
     select sale_number,
            row_number() over (order by sale_number) as rn
     from public.sales
     where tienda_id = 'a1111111-1111-1111-1111-111111111111'::uuid
   ) t
   where (sale_number = 'V-000001' and rn = 1)
      or (sale_number = 'V-000002' and rn = 2)
      or (sale_number = 'V-000003' and rn = 3)),
  3,
  'los sale_number de tienda A son estrictamente crecientes'
);

-- 3. Formato V-NNNNNN (6 dígitos) para toda venta nueva.
select is(
  (select count(*)::int
   from public.sales
   where tienda_id in (
           'a1111111-1111-1111-1111-111111111111'::uuid,
           'b1111111-1111-1111-1111-111111111111'::uuid
         )
     and sale_number !~ '^V-[0-9]{6}$'),
  0,
  'todo sale_number nuevo matchea ^V-[0-9]{6}$'
);

-- 4. Unicidad por tienda: distinct == count en tienda A.
select is(
  (select count(distinct sale_number)::int
   from public.sales
   where tienda_id = 'a1111111-1111-1111-1111-111111111111'::uuid),
  (select count(*)::int
   from public.sales
   where tienda_id = 'a1111111-1111-1111-1111-111111111111'::uuid),
  'sale_number único por tienda A'
);

-- 5. Aislamiento entre tiendas: tienda B arranca en V-000001.
select is(
  (select sale_number
   from public.sales
   where tienda_id = 'b1111111-1111-1111-1111-111111111111'::uuid),
  'V-000001',
  'tienda B arranca su propio correlativo en V-000001'
);

-- 6. Idempotencia: reintento de a-idem-1 devuelve el mismo sale_id.
select is(
  public.create_sale_atomic(
    'a1111111-1111-1111-1111-111111111111'::uuid,
    'a3333333-3333-3333-3333-333333333333'::uuid,
    '', 'a2222222-2222-2222-2222-222222222222'::uuid, null,
    5000, 0, 0, 5000, 'a-idem-1',
    jsonb_build_array(jsonb_build_object(
      'producto_id', 'a5555555-5555-5555-5555-555555555555', 'producto_nombre', 'Producto A',
      'producto_sku', null, 'quantity', 1, 'unit_price', 5000, 'discount_amount', 0,
      'tax_rate', 0, 'tax_amount', 0, 'total', 5000)),
    jsonb_build_array(jsonb_build_object('metodo', 'cash', 'amount', 5000))),
  (select id from public.sales where idempotency_key = 'a-idem-1'
     and tienda_id = 'a1111111-1111-1111-1111-111111111111'::uuid),
  'reintento idempotente devuelve la venta original'
);

-- 7. El reintento NO consume número: last_number de tienda A sigue en 3.
select is(
  (select last_number
   from public.sale_counters
   where tienda_id = 'a1111111-1111-1111-1111-111111111111'::uuid),
  3::bigint,
  'la idempotencia no avanza el counter (sigue en 3 tras el reintento)'
);

select * from finish();

rollback;
