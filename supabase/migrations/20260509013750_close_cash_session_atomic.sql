-- =====================================================
-- close_cash_session_atomic — auditoría 2026-05-08 (P4)
-- =====================================================
-- Reemplaza la lógica multi-query del repositorio Angular
-- (cash-register.repository.ts) por una transacción única en DB.
-- Garantiza atomicidad: nadie puede insertar ventas o movimientos
-- entre la lectura del breakdown y el UPDATE de cash_sessions.
--
-- Reglas de negocio incluidas:
--   - Sólo el dueño de la sesión (opened_by) o un admin de la tienda puede cerrar.
--   - La sesión debe estar `open` (idempotente: si ya está cerrada, retorna error).
--   - Diferencias > 5000 (efectivo o ventas) requieren `notas_cierre`.
--   - Los breakdown esperados/confirmados se persisten en `payment_closure`.
-- =====================================================

create or replace function public.close_cash_session_atomic(
  p_session_id      uuid,
  p_tienda_id       uuid,
  p_closed_by       uuid,
  p_actual_cash     numeric,
  p_actual_payments jsonb,        -- [{ "metodo": "card", "total": 12345 }, ...]
  p_notas_cierre    text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid                 uuid := auth.uid();
  v_session             record;
  v_is_owner            boolean;
  v_is_admin            boolean;
  v_movs_total          numeric := 0;
  v_expected_cash_sales numeric := 0;
  v_expected_total      numeric := 0;
  v_actual_cash_sales   numeric;
  v_actual_total        numeric;
  v_cash_difference     numeric;
  v_sales_difference    numeric;
  v_expected_breakdown  jsonb;
  v_actual_breakdown    jsonb;
  v_threshold           numeric := 5000;
begin
  if v_uid is null or v_uid <> p_closed_by then
    raise exception 'No autenticado';
  end if;

  select * into v_session
  from public.cash_sessions
  where id = p_session_id and tienda_id = p_tienda_id
  for update;

  if v_session.id is null then
    raise exception 'Sesion no encontrada';
  end if;

  if v_session.status <> 'open' then
    raise exception 'La caja ya esta cerrada';
  end if;

  v_is_owner := v_session.opened_by = v_uid;
  select exists (
    select 1 from public.user_tiendas
    where user_id = v_uid
      and tienda_id = p_tienda_id
      and rol = 'admin'
      and is_active = true
  ) into v_is_admin;

  if not v_is_owner and not v_is_admin then
    raise exception 'Solo el cajero o un admin pueden cerrar esta caja';
  end if;

  -- Total neto de movimientos (cash_in suma, resto resta).
  select coalesce(sum(case when tipo = 'cash_in' then amount else -amount end), 0)
    into v_movs_total
  from public.cash_movements
  where cash_session_id = p_session_id;

  -- Breakdown esperado por método de pago.
  with pay_sums as (
    select p.metodo::text as metodo, sum(p.amount)::numeric as total, count(*)::int as cnt
    from public.payments p
    join public.sales s on s.id = p.sale_id
    where s.cash_session_id = p_session_id
      and s.tienda_id = p_tienda_id
      and s.status = 'completed'
    group by p.metodo
  )
  select coalesce(jsonb_agg(jsonb_build_object('metodo', metodo, 'count', cnt, 'total', total)
                              order by total desc), '[]'::jsonb)
    into v_expected_breakdown
  from pay_sums;

  v_expected_cash_sales := coalesce(
    (select sum((m->>'total')::numeric)
     from jsonb_array_elements(v_expected_breakdown) m
     where m->>'metodo' = 'cash'), 0);

  v_expected_total := coalesce(
    (select sum((m->>'total')::numeric)
     from jsonb_array_elements(v_expected_breakdown) m), 0);

  v_actual_cash_sales := p_actual_cash - v_session.opening_amount - v_movs_total;

  -- Construye breakdown confirmado: efectivo derivado, resto desde p_actual_payments.
  with provided as (
    select coalesce(elem->>'metodo', '') as metodo,
           coalesce((elem->>'total')::numeric, 0) as total
    from jsonb_array_elements(coalesce(p_actual_payments, '[]'::jsonb)) elem
  ),
  by_method as (
    select metodo,
           case when metodo = 'cash' then v_actual_cash_sales
                else coalesce(sum(total), 0)
           end as total
    from provided
    where metodo <> ''
    group by metodo
  ),
  with_cash as (
    select 'cash' as metodo, v_actual_cash_sales as total
    union all
    select metodo, total from by_method where metodo <> 'cash'
  )
  select coalesce(jsonb_agg(jsonb_build_object('metodo', metodo, 'total', total)
                              order by total desc), '[]'::jsonb)
    into v_actual_breakdown
  from with_cash;

  v_actual_total := coalesce(
    (select sum((m->>'total')::numeric)
     from jsonb_array_elements(v_actual_breakdown) m), 0);

  v_cash_difference  := (v_session.opening_amount + v_expected_cash_sales + v_movs_total) - p_actual_cash;
  v_sales_difference := v_expected_total - v_actual_total;

  if (abs(v_cash_difference) > v_threshold or abs(v_sales_difference) > v_threshold)
     and (p_notas_cierre is null or btrim(p_notas_cierre) = '') then
    raise exception 'Diferencias mayores a $%.0f requieren nota de cierre', v_threshold;
  end if;

  update public.cash_sessions
  set status                = 'closed',
      closed_by             = p_closed_by,
      actual_cash_amount    = p_actual_cash,
      expected_cash_amount  = v_session.opening_amount + v_expected_cash_sales + v_movs_total,
      difference            = v_cash_difference,
      expected_sales_amount = v_expected_total,
      actual_sales_amount   = v_actual_total,
      sales_difference      = v_sales_difference,
      payment_closure       = jsonb_build_object('expected', v_expected_breakdown, 'actual', v_actual_breakdown),
      notas_cierre          = nullif(btrim(coalesce(p_notas_cierre, '')), ''),
      closed_at             = now()
  where id = p_session_id;

  insert into public.audit_logs (tienda_id, user_id, action, entity_type, entity_id, metadata)
  values (
    p_tienda_id, p_closed_by, 'cash_session.closed', 'cash_session', p_session_id,
    jsonb_build_object(
      'cash_difference',  v_cash_difference,
      'sales_difference', v_sales_difference,
      'has_notes',        nullif(btrim(coalesce(p_notas_cierre, '')), '') is not null
    )
  );

  return p_session_id;
end;
$$;

revoke execute on function public.close_cash_session_atomic(uuid, uuid, uuid, numeric, jsonb, text) from public, anon;
grant  execute on function public.close_cash_session_atomic(uuid, uuid, uuid, numeric, jsonb, text) to authenticated;
