-- Datos descartables para probar el historial de Caja con volumen.
-- Ejecutar solo contra Supabase local. Es idempotente: mantiene exactamente
-- los mismos 100 UUID y actualiza sus valores si se vuelve a ejecutar.

begin;

do $$
begin
  if not exists (
    select 1 from auth.users where email = 'admin@moveon.local'
  ) then
    raise exception 'Primero crea el usuario local admin@moveon.local';
  end if;
end
$$;

with admin_user as (
  select id
  from auth.users
  where email = 'admin@moveon.local'
  limit 1
), generated as (
  select
    gs,
    ('a1000000-0000-0000-0000-' || lpad(to_hex(gs), 12, '0'))::uuid as id,
    admin_user.id as user_id,
    (100000 + (gs % 4) * 25000)::numeric(14, 2) as opening_amount,
    (200000 + (gs % 10) * 15000)::numeric(14, 2) as cash_sales,
    (150000 + (gs % 8) * 20000)::numeric(14, 2) as transfer_sales,
    (case gs % 5 when 0 then -5000 when 2 then 2000 when 3 then 5000 else 0 end)::numeric(14, 2) as variance,
    (100000 + (gs % 3) * 25000)::numeric(14, 2) as cash_left,
    5 + (gs % 10) as cash_count,
    3 + (gs % 7) as transfer_count,
    timestamptz '2026-09-14 20:00:00-05' - (gs * interval '12 hours') as opened_at
  from generate_series(1, 100) as series(gs)
  cross join admin_user
), closures as (
  select
    *,
    opening_amount + cash_sales as expected_cash,
    opening_amount + cash_sales + variance as actual_cash,
    cash_sales + transfer_sales as expected_sales,
    cash_sales + transfer_sales + variance as actual_sales
  from generated
)
insert into public.cash_sessions (
  id,
  tienda_id,
  opened_by,
  closed_by,
  opening_amount,
  expected_cash_amount,
  actual_cash_amount,
  closing_withdrawal_amount,
  cash_left_amount,
  difference,
  expected_sales_amount,
  actual_sales_amount,
  sales_difference,
  payment_closure,
  status,
  notas_cierre,
  opened_at,
  closed_at
)
select
  id,
  '00000000-0000-0000-0000-000000000001'::uuid,
  user_id,
  user_id,
  opening_amount,
  expected_cash,
  actual_cash,
  actual_cash - cash_left,
  cash_left,
  expected_cash - actual_cash,
  expected_sales,
  actual_sales,
  expected_sales - actual_sales,
  jsonb_build_object(
    'expected', jsonb_build_array(
      jsonb_build_object('metodo', 'cash', 'count', cash_count, 'total', cash_sales),
      jsonb_build_object('metodo', 'transfer', 'count', transfer_count, 'total', transfer_sales)
    ),
    'actual', jsonb_build_array(
      jsonb_build_object('metodo', 'cash', 'count', cash_count, 'total', cash_sales + variance),
      jsonb_build_object('metodo', 'transfer', 'count', transfer_count, 'total', transfer_sales)
    )
  ),
  'closed',
  'Cierre ficticio para prueba de volumen #' || gs,
  opened_at,
  opened_at + interval '8 hours'
from closures
on conflict (id) do update set
  tienda_id = excluded.tienda_id,
  opened_by = excluded.opened_by,
  closed_by = excluded.closed_by,
  opening_amount = excluded.opening_amount,
  expected_cash_amount = excluded.expected_cash_amount,
  actual_cash_amount = excluded.actual_cash_amount,
  closing_withdrawal_amount = excluded.closing_withdrawal_amount,
  cash_left_amount = excluded.cash_left_amount,
  difference = excluded.difference,
  expected_sales_amount = excluded.expected_sales_amount,
  actual_sales_amount = excluded.actual_sales_amount,
  sales_difference = excluded.sales_difference,
  payment_closure = excluded.payment_closure,
  status = excluded.status,
  notas_cierre = excluded.notas_cierre,
  opened_at = excluded.opened_at,
  closed_at = excluded.closed_at;

commit;
