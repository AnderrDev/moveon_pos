-- Datos de la prueba de paridad de owner_finance_summary (PLAN-83).
-- Lo ejecuta tests/integration/owner-finance-summary.parity.test.ts con psql en
-- el Supabase LOCAL, como postgres y con variables :tienda :admin.
-- Mes bajo prueba: agosto 2026 (America/Bogota, UTC−5). Tendencia: mar–ago.
begin;

insert into public.tiendas (id, nombre, timezone) values (:'tienda', 'Paridad finanzas', 'America/Bogota');
insert into public.user_tiendas (user_id, tienda_id, rol, is_active) values (:'admin', :'tienda', 'admin', true);

insert into public.productos (id, tienda_id, nombre, tipo, precio_venta, costo, iva_tasa, stock_minimo, is_active) values
  ('ca000000-0000-4000-8000-000000000001', :'tienda', 'Proteína finanzas', 'simple', 100000, 60000, 0, 0, true),
  ('ca000000-0000-4000-8000-000000000002', :'tienda', 'Batido finanzas', 'prepared', 12000, null, 0, 0, true);

insert into public.cash_sessions (id, tienda_id, opened_by, opening_amount, status) values
  ('cb000000-0000-4000-8000-000000000001', :'tienda', :'admin', 100000, 'open');

insert into public.reinvestment_fund_settings (tienda_id, saldo_inicial, fecha_inicio) values (:'tienda', 500000, '2026-06-01');

insert into public.expense_categories (id, tienda_id, nombre, slug) values
  ('cc000000-0000-4000-8000-000000000001', :'tienda', 'Arriendo', 'paridad-arriendo'),
  ('cc000000-0000-4000-8000-000000000002', :'tienda', 'Servicios', 'paridad-servicios');

-- Gastos: dos activos en agosto (uno el último día), uno anulado, uno en julio y
-- uno en septiembre (fuera del mes y de la tendencia).
insert into public.expenses (tienda_id, category_id, concepto, monto, fecha_gasto, metodo_pago, created_by, status) values
  (:'tienda', 'cc000000-0000-4000-8000-000000000001', 'Arriendo agosto', 1200000, '2026-08-05', 'transferencia', :'admin', 'active'),
  (:'tienda', 'cc000000-0000-4000-8000-000000000002', 'Luz', 137500, '2026-08-31', 'efectivo_externo', :'admin', 'active'),
  (:'tienda', 'cc000000-0000-4000-8000-000000000002', 'Luz duplicada', 137500, '2026-08-31', 'efectivo_externo', :'admin', 'voided'),
  (:'tienda', 'cc000000-0000-4000-8000-000000000001', 'Arriendo julio', 1200000, '2026-07-05', 'transferencia', :'admin', 'active'),
  (:'tienda', 'cc000000-0000-4000-8000-000000000001', 'Arriendo septiembre', 1200000, '2026-09-05', 'transferencia', :'admin', 'active');

-- Compras del fondo: con costo en junio y agosto; una sin costo; una antes de la fecha de inicio.
insert into public.inventory_movements (tienda_id, producto_id, tipo, ubicacion, cantidad, costo_unitario, motivo, created_by, created_at) values
  (:'tienda', 'ca000000-0000-4000-8000-000000000001', 'entry', 'bodega', 10, 60000, 'Compra junio', :'admin', '2026-06-10T15:00:00Z'),
  (:'tienda', 'ca000000-0000-4000-8000-000000000001', 'entry', 'bodega', 5, 62000, 'Compra agosto', :'admin', '2026-08-12T15:00:00Z'),
  (:'tienda', 'ca000000-0000-4000-8000-000000000001', 'entry', 'bodega', 3, null, 'Compra sin costo', :'admin', '2026-08-13T15:00:00Z'),
  (:'tienda', 'ca000000-0000-4000-8000-000000000001', 'entry', 'bodega', 2, 50000, 'Antes del fondo', :'admin', '2026-05-20T15:00:00Z');

select set_config('request.jwt.claim.sub', :'admin', true);

-- Ventas. Agosto: mixta con costo, una con producto sin costo pagada con tarjeta,
-- una anulada, y una el 31 a las 23:30 hora Colombia (sigue siendo agosto).
insert into public.sales (id, tienda_id, cash_session_id, sale_number, cashier_id, subtotal, total, idempotency_key, created_at) values
  ('cd000000-0000-4000-8000-000000000001', :'tienda', 'cb000000-0000-4000-8000-000000000001', 'FIN-1', :'admin', 200000, 200000, 'fin-1-' || :'tienda', '2026-08-10T15:00:00Z'),
  ('cd000000-0000-4000-8000-000000000002', :'tienda', 'cb000000-0000-4000-8000-000000000001', 'FIN-2', :'admin', 24000, 24000, 'fin-2-' || :'tienda', '2026-08-15T15:00:00Z'),
  ('cd000000-0000-4000-8000-000000000004', :'tienda', 'cb000000-0000-4000-8000-000000000001', 'FIN-4', :'admin', 100000, 100000, 'fin-4-' || :'tienda', '2026-09-01T04:30:00Z'),
  -- Meses anteriores (tendencia) y septiembre (fuera).
  ('cd000000-0000-4000-8000-000000000005', :'tienda', 'cb000000-0000-4000-8000-000000000001', 'FIN-5', :'admin', 300000, 300000, 'fin-5-' || :'tienda', '2026-03-10T15:00:00Z'),
  ('cd000000-0000-4000-8000-000000000006', :'tienda', 'cb000000-0000-4000-8000-000000000001', 'FIN-6', :'admin', 100000, 100000, 'fin-6-' || :'tienda', '2026-07-10T15:00:00Z'),
  ('cd000000-0000-4000-8000-000000000007', :'tienda', 'cb000000-0000-4000-8000-000000000001', 'FIN-7', :'admin', 100000, 100000, 'fin-7-' || :'tienda', '2026-09-02T15:00:00Z');
insert into public.sales (id, tienda_id, cash_session_id, sale_number, cashier_id, subtotal, total, idempotency_key, created_at, status, voided_by, voided_at, voided_reason) values
  ('cd000000-0000-4000-8000-000000000003', :'tienda', 'cb000000-0000-4000-8000-000000000001', 'FIN-3', :'admin', 900000, 900000, 'fin-3-' || :'tienda', '2026-08-20T15:00:00Z', 'voided', :'admin', '2026-08-20T16:00:00Z', 'Prueba');

insert into public.sale_items (sale_id, producto_id, producto_nombre, quantity, unit_price, unit_cost, total) values
  ('cd000000-0000-4000-8000-000000000001', 'ca000000-0000-4000-8000-000000000001', 'Proteína finanzas', 2, 100000, 60000, 200000),
  ('cd000000-0000-4000-8000-000000000002', 'ca000000-0000-4000-8000-000000000002', 'Batido finanzas', 2, 12000, null, 24000),
  ('cd000000-0000-4000-8000-000000000003', 'ca000000-0000-4000-8000-000000000001', 'Proteína finanzas', 9, 100000, 60000, 900000),
  ('cd000000-0000-4000-8000-000000000004', 'ca000000-0000-4000-8000-000000000001', 'Proteína finanzas', 1, 100000, 61000, 100000),
  ('cd000000-0000-4000-8000-000000000005', 'ca000000-0000-4000-8000-000000000001', 'Proteína finanzas', 3, 100000, 55000, 300000),
  ('cd000000-0000-4000-8000-000000000006', 'ca000000-0000-4000-8000-000000000001', 'Proteína finanzas', 1, 100000, 60000, 100000),
  ('cd000000-0000-4000-8000-000000000007', 'ca000000-0000-4000-8000-000000000001', 'Proteína finanzas', 1, 100000, 60000, 100000);

insert into public.payments (sale_id, metodo, amount) values
  ('cd000000-0000-4000-8000-000000000001', 'cash', 80000),
  ('cd000000-0000-4000-8000-000000000001', 'transfer', 120000),
  ('cd000000-0000-4000-8000-000000000002', 'card', 24000),
  ('cd000000-0000-4000-8000-000000000003', 'cash', 900000),
  ('cd000000-0000-4000-8000-000000000004', 'cash', 100000),
  ('cd000000-0000-4000-8000-000000000005', 'cash', 300000),
  ('cd000000-0000-4000-8000-000000000006', 'transfer', 100000),
  ('cd000000-0000-4000-8000-000000000007', 'cash', 100000);

commit;
