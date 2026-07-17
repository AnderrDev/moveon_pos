-- =====================================================
-- Anulación de movimientos de caja (cash_movements)
-- =====================================================
-- Origen: auditoría 2026-06-19. Se encontró que la única forma de "corregir"
-- un cash_movement mal registrado era crear un movimiento inverso manual sin
-- ningún vínculo estructurado (solo el texto libre de `motivo`) — exactamente
-- lo que pasó la noche del 2026-06-18 (cash_out $36.000 "Anderson cerro caja"
-- seguido 3 minutos después de un cash_in $36.000 "Correccion entrada").
-- No hubo pérdida de dinero (el cierre cuadró en $0), pero el rastro de
-- auditoría queda frágil e ilegible para revisiones futuras.
--
-- Esta migración agrega anulación con auditoría para cash_movements, espejo
-- de void_sale_atomic: solo admin, columnas voided_by/voided_at/voided_reason,
-- y exclusión del movimiento anulado de los cálculos de cierre (RN-C03).
-- =====================================================

create type cash_movement_status as enum ('active', 'voided');

alter table cash_movements
  add column status        cash_movement_status not null default 'active',
  add column voided_by     uuid references auth.users(id),
  add column voided_at     timestamptz,
  add column voided_reason text;

-- ---------- void_cash_movement_atomic ----------

create or replace function public.void_cash_movement_atomic(
  p_movement_id   uuid,
  p_tienda_id     uuid,
  p_voided_by     uuid,
  p_voided_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_movement_id uuid;
begin
  if auth.uid() is null or auth.uid() <> p_voided_by then
    raise exception 'No autenticado';
  end if;

  if not exists (
    select 1 from public.user_tiendas
    where user_id = auth.uid()
      and tienda_id = p_tienda_id
      and rol = 'admin'
      and is_active = true
  ) then
    raise exception 'Solo el admin puede anular movimientos de caja';
  end if;

  update public.cash_movements cm
  set status        = 'voided',
      voided_by     = p_voided_by,
      voided_at     = now(),
      voided_reason = p_voided_reason
  from public.cash_sessions cs
  where cm.id = p_movement_id
    and cm.cash_session_id = cs.id
    and cs.tienda_id = p_tienda_id
    and cm.status = 'active'
  returning cm.id into v_movement_id;

  if v_movement_id is null then
    raise exception 'Movimiento no encontrado o ya anulado';
  end if;

  insert into public.audit_logs (tienda_id, user_id, action, entity_type, entity_id, metadata)
  values (
    p_tienda_id, p_voided_by, 'cash_movement.voided', 'cash_movement', p_movement_id,
    jsonb_build_object('reason', p_voided_reason)
  );

  return v_movement_id;
end;
$$;

revoke execute on function public.void_cash_movement_atomic(uuid, uuid, uuid, text) from public, anon;
grant  execute on function public.void_cash_movement_atomic(uuid, uuid, uuid, text) to authenticated;

-- ---------- close_cash_session_atomic: excluir movimientos anulados ----------
-- Cuerpo idéntico a la versión vigente (20260528_001_shared_cash_session_per_store.sql)
-- salvo el filtro `and status = 'active'` en el cálculo de v_movs_total.

create or replace function public.close_cash_session_atomic(
  p_session_id      uuid,
  p_tienda_id       uuid,
  p_closed_by       uuid,
  p_actual_cash     numeric,
  p_actual_payments jsonb,
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

  -- PLAN-19: caja compartida. Cualquier usuario activo de la tienda puede
  -- cerrar la sesión compartida (antes: solo el dueño `opened_by` o un admin).
  if not exists (
    select 1 from public.user_tiendas
    where user_id = v_uid and tienda_id = p_tienda_id and is_active = true
  ) then
    raise exception 'Solo un usuario activo de la tienda puede cerrar esta caja';
  end if;

  -- Total neto de movimientos (cash_in suma, resto resta). Los anulados no cuentan.
  select coalesce(sum(case when tipo = 'cash_in' then amount else -amount end), 0)
    into v_movs_total
  from public.cash_movements
  where cash_session_id = p_session_id
    and status = 'active';

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
