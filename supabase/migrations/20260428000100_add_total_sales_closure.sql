-- Cierre de caja por total de ventas, no solo efectivo fisico.
alter table cash_sessions
  add column if not exists expected_sales_amount numeric(14,2),
  add column if not exists actual_sales_amount numeric(14,2),
  add column if not exists sales_difference numeric(14,2),
  add column if not exists payment_closure jsonb not null default '{}'::jsonb;

comment on column cash_sessions.expected_cash_amount is
  'Efectivo fisico esperado en cajon: apertura + ventas cash + movimientos.';

comment on column cash_sessions.difference is
  'Diferencia de efectivo fisico: expected_cash_amount - actual_cash_amount.';

comment on column cash_sessions.expected_sales_amount is
  'Total esperado de ventas completadas de la sesion, sumando todos los medios de pago.';

comment on column cash_sessions.actual_sales_amount is
  'Total confirmado al cierre, derivado del efectivo contado y los medios digitales confirmados.';

comment on column cash_sessions.sales_difference is
  'Diferencia total de ventas: expected_sales_amount - actual_sales_amount.';

comment on column cash_sessions.payment_closure is
  'Desglose esperado y confirmado por metodo de pago al momento del cierre.';
