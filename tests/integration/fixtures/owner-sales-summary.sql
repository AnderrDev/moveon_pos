-- Datos de la prueba de paridad de owner_sales_summary (PLAN-78).
-- Lo ejecuta tests/integration/owner-sales-summary.parity.test.ts con psql en
-- el Supabase LOCAL, como postgres y con variables :tienda :otra :admin :cajero.
-- Horas en America/Bogota (UTC−5): "día 1" = 2026-10-20, "día 2" = 2026-10-21.
begin;

insert into public.tiendas (id, nombre, timezone) values
  (:'tienda', 'Paridad owner_sales_summary', 'America/Bogota'),
  (:'otra', 'Paridad otra tienda', 'America/Bogota');

insert into public.user_tiendas (user_id, tienda_id, rol, is_active) values
  (:'admin', :'tienda', 'admin', true),
  (:'cajero', :'tienda', 'cajero', true),
  (:'admin', :'otra', 'admin', true);

insert into public.productos (id, tienda_id, nombre, sku, tipo, precio_venta, costo, iva_tasa, stock_minimo, is_active) values
  ('c0000000-0000-4000-8000-000000000001', :'tienda', 'Proteína paridad', 'PAR-01', 'simple', 10000, 4000, 0, 0, true),
  ('c0000000-0000-4000-8000-000000000002', :'tienda', 'Snack sin costo', 'PAR-02', 'simple', 8000, null, 0, 0, true),
  ('c0000000-0000-4000-8000-000000000003', :'tienda', 'Combo paridad', 'PAR-03', 'combo', 25000, null, 0, 0, true),
  ('c0000000-0000-4000-8000-000000000004', :'tienda', 'Batido paridad', null, 'prepared', 12000, 3500, 0, 0, true),
  ('c0000000-0000-4000-8000-000000000005', :'otra', 'Producto otra tienda', null, 'simple', 99000, 1000, 0, 0, true);

insert into public.cash_sessions (id, tienda_id, opened_by, opening_amount, status) values
  ('c1000000-0000-4000-8000-000000000001', :'tienda', :'admin', 100000, 'open'),
  ('c1000000-0000-4000-8000-000000000002', :'otra', :'admin', 100000, 'open');

-- El trigger de identidad exige que cashier_id sea el usuario de la sesión.
select set_config('request.jwt.claim.sub', :'admin', true);

-- S0: día 0 a las 23:59 → fuera del período.
insert into public.sales (id, tienda_id, cash_session_id, sale_number, cashier_id, subtotal, total, idempotency_key, created_at) values
  ('c2000000-0000-4000-8000-000000000000', :'tienda', 'c1000000-0000-4000-8000-000000000001', 'PAR-0', :'admin', 10000, 10000, 'par-0-' || :'tienda', '2026-10-20T04:59:00Z');
insert into public.sale_items (sale_id, producto_id, producto_nombre, quantity, unit_price, unit_cost, total) values
  ('c2000000-0000-4000-8000-000000000000', 'c0000000-0000-4000-8000-000000000001', 'Proteína paridad', 1, 10000, 4000, 10000);
insert into public.payments (sale_id, metodo, amount) values ('c2000000-0000-4000-8000-000000000000', 'cash', 10000);

-- S1: día 1 09:15, dos unidades con costo.
insert into public.sales (id, tienda_id, cash_session_id, sale_number, cashier_id, subtotal, total, idempotency_key, created_at) values
  ('c2000000-0000-4000-8000-000000000001', :'tienda', 'c1000000-0000-4000-8000-000000000001', 'PAR-1', :'admin', 20000, 20000, 'par-1-' || :'tienda', '2026-10-20T14:15:00Z');
insert into public.sale_items (sale_id, producto_id, producto_nombre, producto_sku, quantity, unit_price, unit_cost, total) values
  ('c2000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'Proteína paridad', 'PAR-01', 2, 10000, 4000, 20000);
insert into public.payments (sale_id, metodo, amount) values ('c2000000-0000-4000-8000-000000000001', 'cash', 20000);

-- S4: día 1 15:00, anulada (cuenta en el cajero, no en los totales).
insert into public.sales (id, tienda_id, cash_session_id, sale_number, cashier_id, subtotal, total, idempotency_key, created_at, status, voided_by, voided_at, voided_reason) values
  ('c2000000-0000-4000-8000-000000000004', :'tienda', 'c1000000-0000-4000-8000-000000000001', 'PAR-4', :'admin', 50000, 50000, 'par-4-' || :'tienda', '2026-10-20T20:00:00Z', 'voided', :'admin', '2026-10-20T20:05:00Z', 'Prueba de paridad');
insert into public.sale_items (sale_id, producto_id, producto_nombre, quantity, unit_price, unit_cost, total) values
  ('c2000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000001', 'Proteína paridad', 5, 10000, 4000, 50000);
insert into public.payments (sale_id, metodo, amount) values ('c2000000-0000-4000-8000-000000000004', 'cash', 50000);

-- S5: día 2 10:00, canje del Club (línea en 0) + una proteína.
insert into public.sales (id, tienda_id, cash_session_id, sale_number, cashier_id, subtotal, discount_total, loyalty_discount_total, discount_reason, total, idempotency_key, created_at) values
  ('c2000000-0000-4000-8000-000000000005', :'tienda', 'c1000000-0000-4000-8000-000000000001', 'PAR-5', :'admin', 22000, 12000, 12000, 'Canje MOVE ON Club', 10000, 'par-5-' || :'tienda', '2026-10-21T15:00:00Z');
insert into public.sale_items (sale_id, producto_id, producto_nombre, quantity, unit_price, unit_cost, loyalty_discount_amount, total) values
  ('c2000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000004', 'Batido paridad', 1, 12000, 3500, 12000, 0),
  ('c2000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000001', 'Proteína paridad (nuevo nombre)', 1, 10000, 4200, 0, 10000);
insert into public.payments (sale_id, metodo, amount) values ('c2000000-0000-4000-8000-000000000005', 'cash', 10000);

-- S6: día 3 08:00 → fuera del período.
insert into public.sales (id, tienda_id, cash_session_id, sale_number, cashier_id, subtotal, total, idempotency_key, created_at) values
  ('c2000000-0000-4000-8000-000000000006', :'tienda', 'c1000000-0000-4000-8000-000000000001', 'PAR-6', :'admin', 10000, 10000, 'par-6-' || :'tienda', '2026-10-22T13:00:00Z');
insert into public.sale_items (sale_id, producto_id, producto_nombre, quantity, unit_price, unit_cost, total) values
  ('c2000000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000001', 'Proteína paridad', 1, 10000, 4000, 10000);
insert into public.payments (sale_id, metodo, amount) values ('c2000000-0000-4000-8000-000000000006', 'cash', 10000);

-- Otra tienda el mismo día: nunca debe aparecer.
insert into public.sales (id, tienda_id, cash_session_id, sale_number, cashier_id, subtotal, total, idempotency_key, created_at) values
  ('c2000000-0000-4000-8000-000000000009', :'otra', 'c1000000-0000-4000-8000-000000000002', 'PAR-9', :'admin', 99000, 99000, 'par-9-' || :'otra', '2026-10-20T15:00:00Z');
insert into public.sale_items (sale_id, producto_id, producto_nombre, quantity, unit_price, unit_cost, total) values
  ('c2000000-0000-4000-8000-000000000009', 'c0000000-0000-4000-8000-000000000005', 'Producto otra tienda', 1, 99000, 1000, 99000);
insert into public.payments (sale_id, metodo, amount) values ('c2000000-0000-4000-8000-000000000009', 'card', 99000);

select set_config('request.jwt.claim.sub', :'cajero', true);

-- S2: día 1 09:40, cajero, descuento global, línea sin costo y pago mixto.
insert into public.sales (id, tienda_id, cash_session_id, sale_number, cashier_id, subtotal, discount_total, global_discount_total, discount_reason, total, idempotency_key, created_at) values
  ('c2000000-0000-4000-8000-000000000002', :'tienda', 'c1000000-0000-4000-8000-000000000001', 'PAR-2', :'cajero', 18000, 1800, 1800, 'Cliente frecuente', 16200, 'par-2-' || :'tienda', '2026-10-20T14:40:00Z');
insert into public.sale_items (sale_id, producto_id, producto_nombre, quantity, unit_price, unit_cost, global_discount_amount, total) values
  ('c2000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', 'Proteína paridad', 1, 10000, 4000, 1000, 9000),
  ('c2000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002', 'Snack sin costo', 1, 8000, null, 800, 7200);
insert into public.payments (sale_id, metodo, amount) values
  ('c2000000-0000-4000-8000-000000000002', 'cash', 5000),
  ('c2000000-0000-4000-8000-000000000002', 'transfer', 11200);

-- S3: día 1 23:30 local (día 2 04:30Z), combo con costo de sus componentes.
insert into public.sales (id, tienda_id, cash_session_id, sale_number, cashier_id, subtotal, total, idempotency_key, created_at) values
  ('c2000000-0000-4000-8000-000000000003', :'tienda', 'c1000000-0000-4000-8000-000000000001', 'PAR-3', :'cajero', 25000, 25000, 'par-3-' || :'tienda', '2026-10-21T04:30:00Z');
insert into public.sale_items (sale_id, producto_id, producto_nombre, quantity, unit_price, unit_cost, total) values
  ('c2000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000003', 'Combo paridad', 1, 25000, 12345.5, 25000);
insert into public.payments (sale_id, metodo, amount) values ('c2000000-0000-4000-8000-000000000003', 'card', 25000);

commit;
