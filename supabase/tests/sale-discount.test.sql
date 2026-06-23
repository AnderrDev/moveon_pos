begin;

create extension if not exists pgtap;

select plan(8);

do $$
declare
  v_tienda uuid := 'd1111111-1111-1111-1111-111111111111';
  v_admin uuid := 'd2222222-2222-2222-2222-222222222222';
  v_cashier uuid := 'd2222222-2222-2222-2222-222222222223';
  v_session uuid := 'd3333333-3333-3333-3333-333333333333';
  v_product uuid := 'd5555555-5555-5555-5555-555555555555';
begin
  insert into auth.users (id, email, raw_user_meta_data)
  values
    (v_admin, 'discount-admin@local.test', '{}'::jsonb),
    (v_cashier, 'discount-cashier@local.test', '{}'::jsonb)
  on conflict (id) do nothing;

  insert into public.tiendas (id, nombre) values (v_tienda, 'Discount Test Store');
  insert into public.user_tiendas (user_id, tienda_id, rol, is_active)
  values
    (v_admin, v_tienda, 'admin', true),
    (v_cashier, v_tienda, 'cajero', true);
  insert into public.cash_sessions (id, tienda_id, opened_by, opening_amount, status)
  values (v_session, v_tienda, v_admin, 0, 'open');
  insert into public.productos (id, tienda_id, nombre, precio_venta, iva_tasa, is_active)
  values (v_product, v_tienda, 'Producto gravado', 119000, 19, true);
  insert into public.inventory_movements (
    tienda_id, producto_id, tipo, cantidad, ubicacion, motivo, created_by
  ) values (v_tienda, v_product, 'entry', 10, 'punto_venta', 'Stock prueba descuentos', v_admin);
end $$;

select set_config('request.jwt.claim.sub', 'd2222222-2222-2222-2222-222222222222', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"d2222222-2222-2222-2222-222222222222","email":"discount-admin@local.test","role":"authenticated"}',
  true
);

select isnt(
  public.create_sale_atomic(
    'd1111111-1111-1111-1111-111111111111',
    'd3333333-3333-3333-3333-333333333333',
    '',
    'd2222222-2222-2222-2222-222222222222',
    null,
    1, 1, 0, 1,
    'discount-admin-sale',
    jsonb_build_array(jsonb_build_object(
      'producto_id', 'd5555555-5555-5555-5555-555555555555',
      'producto_nombre', 'Nombre manipulado',
      'quantity', 1,
      'unit_price', 1,
      'discount_amount', 10000,
      'tax_rate', 0,
      'tax_amount', 0,
      'total', 1
    )),
    jsonb_build_array(jsonb_build_object('metodo', 'cash', 'amount', 100000)),
    9000,
    'Promoción autorizada'
  )::text,
  '',
  'admin crea venta con descuento por encima del umbral de cajero (50%)'
);

select is(
  (select subtotal from public.sales where idempotency_key = 'discount-admin-sale'),
  119000::numeric,
  'el subtotal usa el precio vigente del producto y no el payload'
);

select results_eq(
  $$
    select item_discount_total, global_discount_total, discount_total
    from public.sales where idempotency_key = 'discount-admin-sale'
  $$,
  $$ values (10000::numeric, 9000::numeric, 19000::numeric) $$,
  'guarda el desglose completo del descuento'
);

select results_eq(
  $$ select total, tax_total from public.sales where idempotency_key = 'discount-admin-sale' $$,
  $$ values (100000::numeric, 15966::numeric) $$,
  'recalcula total e IVA después del descuento global'
);

select is(
  (select global_discount_amount from public.sale_items si
   join public.sales s on s.id = si.sale_id
   where s.idempotency_key = 'discount-admin-sale'),
  9000::numeric,
  'la línea conserva la parte asignada del descuento global'
);

select is(
  (select discount_reason from public.sales where idempotency_key = 'discount-admin-sale'),
  'Promoción autorizada',
  'guarda el motivo del descuento'
);

select is(
  (select count(*)::int from public.audit_logs a
   join public.sales s on s.id = a.entity_id
   where s.idempotency_key = 'discount-admin-sale'
     and a.action = 'sale.discount_applied'),
  1,
  'crea un evento de auditoría para el descuento'
);

select set_config('request.jwt.claim.sub', 'd2222222-2222-2222-2222-222222222223', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"d2222222-2222-2222-2222-222222222223","email":"discount-cashier@local.test","role":"authenticated"}',
  true
);

select throws_ok(
  $$
    select public.create_sale_atomic(
      'd1111111-1111-1111-1111-111111111111',
      'd3333333-3333-3333-3333-333333333333',
      '',
      'd2222222-2222-2222-2222-222222222223',
      null,
      119000, 65000, 0, 54000,
      'discount-cashier-sale',
      jsonb_build_array(jsonb_build_object(
        'producto_id', 'd5555555-5555-5555-5555-555555555555',
        'quantity', 1,
        'discount_amount', 65000
      )),
      jsonb_build_array(jsonb_build_object('metodo', 'cash', 'amount', 119000)),
      0,
      'Descuento de cajero'
    )
  $$,
  'Descuentos mayores al 50% requieren aprobación de admin',
  'el cajero no puede superar el umbral del 50%'
);

select * from finish();

rollback;
