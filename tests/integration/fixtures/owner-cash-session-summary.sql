-- Datos de la prueba de paridad de owner_cash_session_summary (PLAN-81).
-- Lo ejecuta tests/integration/owner-cash-session-summary.parity.test.ts con psql
-- en el Supabase LOCAL, como postgres y con variables :tienda :admin :cajero.
begin;

insert into public.tiendas (id, nombre, timezone) values (:'tienda', 'Paridad caja', 'America/Bogota');

insert into public.user_tiendas (user_id, tienda_id, rol, is_active) values
  (:'admin', :'tienda', 'admin', true),
  (:'cajero', :'tienda', 'cajero', true);

insert into public.productos (id, tienda_id, nombre, tipo, precio_venta, costo, iva_tasa, stock_minimo, is_active) values
  ('c5000000-0000-4000-8000-000000000001', :'tienda', 'Proteína caja', 'simple', 10000, 4000, 0, 0, true);

-- Turno anterior ya cerrado: sus ventas y movimientos no cuentan en el abierto.
insert into public.cash_sessions (id, tienda_id, opened_by, opening_amount, status, opened_at, closed_at, closed_by,
                                  expected_cash_amount, actual_cash_amount, difference, closing_withdrawal_amount, cash_left_amount) values
  ('c6000000-0000-4000-8000-000000000001', :'tienda', :'admin', 50000, 'closed', now() - interval '1 day',
   now() - interval '20 hours', :'admin', 80000, 79000, -1000, 29000, 50000);
insert into public.cash_sessions (id, tienda_id, opened_by, opening_amount, status, opened_at) values
  ('c6000000-0000-4000-8000-000000000002', :'tienda', :'cajero', 100000, 'open', now() - interval '3 hours');

select set_config('request.jwt.claim.sub', :'cajero', true);

-- Turno cerrado: una venta en efectivo.
insert into public.sales (id, tienda_id, cash_session_id, sale_number, cashier_id, subtotal, total, idempotency_key, created_at) values
  ('c7000000-0000-4000-8000-000000000000', :'tienda', 'c6000000-0000-4000-8000-000000000001', 'CAJA-0', :'cajero', 30000, 30000, 'caja-0-' || :'tienda', now() - interval '22 hours');
insert into public.payments (sale_id, metodo, amount) values ('c7000000-0000-4000-8000-000000000000', 'cash', 30000);

-- Turno abierto: efectivo, mixto, tarjeta y una anulada que no cuenta.
insert into public.sales (id, tienda_id, cash_session_id, sale_number, cashier_id, subtotal, total, idempotency_key, created_at) values
  ('c7000000-0000-4000-8000-000000000001', :'tienda', 'c6000000-0000-4000-8000-000000000002', 'CAJA-1', :'cajero', 50000, 50000, 'caja-1-' || :'tienda', now() - interval '2 hours'),
  ('c7000000-0000-4000-8000-000000000002', :'tienda', 'c6000000-0000-4000-8000-000000000002', 'CAJA-2', :'cajero', 50000, 50000, 'caja-2-' || :'tienda', now() - interval '90 minutes'),
  ('c7000000-0000-4000-8000-000000000004', :'tienda', 'c6000000-0000-4000-8000-000000000002', 'CAJA-4', :'cajero', 10000, 10000, 'caja-4-' || :'tienda', now() - interval '30 minutes');
insert into public.sales (id, tienda_id, cash_session_id, sale_number, cashier_id, subtotal, total, idempotency_key, created_at, status, voided_by, voided_at, voided_reason) values
  ('c7000000-0000-4000-8000-000000000003', :'tienda', 'c6000000-0000-4000-8000-000000000002', 'CAJA-3', :'cajero', 99000, 99000, 'caja-3-' || :'tienda', now() - interval '1 hour', 'voided', :'cajero', now(), 'Prueba');
insert into public.payments (sale_id, metodo, amount) values
  ('c7000000-0000-4000-8000-000000000001', 'cash', 50000),
  ('c7000000-0000-4000-8000-000000000002', 'cash', 20000),
  ('c7000000-0000-4000-8000-000000000002', 'transfer', 30000),
  ('c7000000-0000-4000-8000-000000000003', 'cash', 99000),
  ('c7000000-0000-4000-8000-000000000004', 'card', 10000);

-- Movimientos del turno abierto (uno anulado) y uno del turno cerrado.
insert into public.cash_movements (cash_session_id, tipo, amount, motivo, created_by, status) values
  ('c6000000-0000-4000-8000-000000000002', 'cash_in', 15000, 'Sencillo', :'cajero', 'active'),
  ('c6000000-0000-4000-8000-000000000002', 'expense', 8000, 'Bolsas', :'cajero', 'active'),
  ('c6000000-0000-4000-8000-000000000002', 'cash_out', 20000, 'Retiro parcial', :'admin', 'active'),
  ('c6000000-0000-4000-8000-000000000002', 'correction', 3000, 'Ajuste de conteo', :'admin', 'active'),
  ('c6000000-0000-4000-8000-000000000002', 'expense', 50000, 'Gasto mal registrado', :'cajero', 'voided'),
  ('c6000000-0000-4000-8000-000000000001', 'cash_in', 77000, 'Del turno anterior', :'admin', 'active');

commit;
