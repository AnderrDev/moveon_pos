-- =====================================================
-- owner_cash_session_summary: cuadre del turno de caja para la app iOS del dueño (PLAN-81)
-- =====================================================
-- ADR 0021 §4: la app iOS no reimplementa el cuadre. Replica lo que muestra
-- `/caja` del POS web:
--   * `getPaymentBreakdown` (cash-register.repository.ts): pagos de las ventas
--     completadas del turno agrupados por método, ordenados por total;
--   * `computeCashTurnSummary` (cash-register/domain/services/cash-closure.ts):
--     movimientos activos por tipo y efectivo esperado =
--       base + ventas en efectivo + entradas − gastos − retiros − correcciones
--     (la misma fórmula que usa `close_cash_session_atomic` al cerrar).
-- La paridad la prueba tests/integration/owner-cash-session-summary.parity.test.ts.
--
-- Sin `p_session_id` devuelve el turno abierto de la tienda (o `null` si la caja
-- está cerrada). Solo lectura: STABLE + SECURITY INVOKER. Solo `admin`.

create or replace function public.owner_cash_session_summary(
  p_tienda_id uuid,
  p_session_id uuid default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_session public.cash_sessions%rowtype;
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.user_tiendas ut
    where ut.user_id = auth.uid()
      and ut.tienda_id = p_tienda_id
      and ut.rol = 'admin'
      and ut.is_active
  ) then
    raise exception 'Solo el dueño puede ver la caja' using errcode = '42501';
  end if;

  if p_session_id is null then
    select * into v_session
    from public.cash_sessions cs
    where cs.tienda_id = p_tienda_id and cs.status = 'open'
    order by cs.opened_at desc
    limit 1;
  else
    select * into v_session
    from public.cash_sessions cs
    where cs.tienda_id = p_tienda_id and cs.id = p_session_id;
  end if;

  if v_session.id is null then
    return null;
  end if;

  with payment_rows as (
    select p.metodo::text as metodo, count(*) as count, sum(p.amount) as total
    from public.payments p
    join public.sales s on s.id = p.sale_id
    where s.cash_session_id = v_session.id
      and s.tienda_id = p_tienda_id
      and s.status = 'completed'
    group by p.metodo
  ),
  movement_totals as (
    select
      coalesce(sum(m.amount) filter (where m.tipo = 'cash_in'), 0) as cash_in,
      coalesce(sum(m.amount) filter (where m.tipo = 'expense'), 0) as expense,
      coalesce(sum(m.amount) filter (where m.tipo = 'cash_out'), 0) as cash_out,
      coalesce(sum(m.amount) filter (where m.tipo = 'correction'), 0) as correction
    from public.cash_movements m
    where m.cash_session_id = v_session.id
      and m.status = 'active'
  ),
  totals as (
    select
      coalesce((select total from payment_rows where metodo = 'cash'), 0) as cash_sales,
      coalesce((select sum(total) from payment_rows), 0) as sales_total,
      mt.*
    from movement_totals mt
  )
  select jsonb_build_object(
    'session_id', v_session.id,
    'status', v_session.status,
    'opened_at', v_session.opened_at,
    'opening_amount', v_session.opening_amount,
    'sales_total', t.sales_total,
    'cash_sales_amount', t.cash_sales,
    'cash_in_amount', t.cash_in,
    'expense_amount', t.expense,
    'cash_out_amount', t.cash_out,
    'correction_amount', t.correction,
    'movements_total', t.cash_in - t.expense - t.cash_out - t.correction,
    'expected_cash_amount',
      v_session.opening_amount + t.cash_sales + t.cash_in - t.expense - t.cash_out - t.correction,
    'payment_breakdown', coalesce((
      select jsonb_agg(
        jsonb_build_object('metodo', r.metodo, 'count', r.count, 'total', r.total)
        order by r.total desc, r.metodo
      )
      from payment_rows r
    ), '[]'::jsonb)
  )
  into v_result
  from totals t;

  return v_result;
end;
$$;

comment on function public.owner_cash_session_summary(uuid, uuid) is
  'Cuadre del turno de caja (abierto por defecto) para la app iOS del dueño (ADR 0021, PLAN-81). '
  'Solo lectura, solo admin. Paridad con computeCashTurnSummary + getPaymentBreakdown del POS web.';

revoke all on function public.owner_cash_session_summary(uuid, uuid) from public, anon;
grant execute on function public.owner_cash_session_summary(uuid, uuid) to authenticated;
