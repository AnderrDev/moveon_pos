-- Retiro opcional al cierre de caja.
-- `actual_cash_amount` conserva el conteo físico antes del retiro;
-- `cash_left_amount` es lo que queda y la diferencia es el retiro auditado.

alter table public.cash_sessions
  add column closing_withdrawal_amount numeric(14,2),
  add column cash_left_amount numeric(14,2);

-- Los cierres históricos no permiten inferir retiros: se consideran sin retiro.
update public.cash_sessions
set closing_withdrawal_amount = 0,
    cash_left_amount = actual_cash_amount
where status = 'closed'
  and actual_cash_amount is not null;

alter table public.cash_sessions
  add constraint cash_sessions_closing_withdrawal_nonnegative
    check (closing_withdrawal_amount is null or closing_withdrawal_amount >= 0),
  add constraint cash_sessions_cash_left_nonnegative
    check (cash_left_amount is null or cash_left_amount >= 0),
  add constraint cash_sessions_close_cash_consistency
    check (
      status <> 'closed'
      or (
        actual_cash_amount is not null
        and closing_withdrawal_amount is not null
        and cash_left_amount is not null
        and cash_left_amount <= actual_cash_amount
        and closing_withdrawal_amount = actual_cash_amount - cash_left_amount
      )
    ) not valid;

-- Las escrituras de cash_sessions se realizan mediante RPC SECURITY DEFINER
-- para preservar invariantes, bloqueo de fila y audit_logs. SELECT e INSERT
-- permanecen disponibles según RLS; service_role conserva acceso operativo.
revoke update on public.cash_sessions from public, anon, authenticated;

drop function if exists public.close_cash_session_atomic(uuid, uuid, uuid, numeric, jsonb, text);

create function public.close_cash_session_atomic(
  p_session_id      uuid,
  p_tienda_id       uuid,
  p_closed_by       uuid,
  p_actual_cash     numeric,
  p_cash_left       numeric,
  p_actual_payments jsonb,
  p_notas_cierre    text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid                       uuid := auth.uid();
  v_session                   record;
  v_movs_total                numeric := 0;
  v_expected_cash_sales       numeric := 0;
  v_expected_total            numeric := 0;
  v_actual_cash_sales         numeric;
  v_actual_total              numeric;
  v_cash_difference           numeric;
  v_sales_difference          numeric;
  v_closing_withdrawal_amount numeric;
  v_expected_breakdown        jsonb;
  v_actual_breakdown          jsonb;
  v_threshold                 numeric := 5000;
begin
  if v_uid is null or v_uid <> p_closed_by then
    raise exception 'No autenticado';
  end if;

  if p_actual_cash is null then
    raise exception 'El efectivo contado es obligatorio';
  end if;

  if p_cash_left is null then
    raise exception 'El efectivo dejado es obligatorio';
  end if;

  if p_actual_cash < 0 then
    raise exception 'El efectivo contado no puede ser negativo';
  end if;

  if p_cash_left < 0 then
    raise exception 'El efectivo dejado no puede ser negativo';
  end if;

  if p_cash_left > p_actual_cash then
    raise exception 'El efectivo dejado no puede superar el efectivo contado';
  end if;

  v_closing_withdrawal_amount := p_actual_cash - p_cash_left;

  select * into v_session
  from public.cash_sessions
  where id = p_session_id
    and tienda_id = p_tienda_id
  for update;

  if v_session.id is null then
    raise exception 'Sesion no encontrada';
  end if;

  if v_session.status <> 'open' then
    raise exception 'La caja ya esta cerrada';
  end if;

  if not exists (
    select 1
    from public.user_tiendas
    where user_id = v_uid
      and tienda_id = p_tienda_id
      and is_active = true
  ) then
    raise exception 'Solo un usuario activo de la tienda puede cerrar esta caja';
  end if;

  select coalesce(sum(case when tipo = 'cash_in' then amount else -amount end), 0)
    into v_movs_total
  from public.cash_movements
  where cash_session_id = p_session_id
    and status = 'active';

  with pay_sums as (
    select p.metodo::text as metodo,
           sum(p.amount)::numeric as total,
           count(*)::int as cnt
    from public.payments p
    join public.sales s on s.id = p.sale_id
    where s.cash_session_id = p_session_id
      and s.tienda_id = p_tienda_id
      and s.status = 'completed'
    group by p.metodo
  )
  select coalesce(
      jsonb_agg(
        jsonb_build_object('metodo', metodo, 'count', cnt, 'total', total)
        order by total desc
      ),
      '[]'::jsonb
    )
    into v_expected_breakdown
  from pay_sums;

  v_expected_cash_sales := coalesce(
    (
      select sum((method->>'total')::numeric)
      from jsonb_array_elements(v_expected_breakdown) method
      where method->>'metodo' = 'cash'
    ),
    0
  );

  v_expected_total := coalesce(
    (
      select sum((method->>'total')::numeric)
      from jsonb_array_elements(v_expected_breakdown) method
    ),
    0
  );

  v_actual_cash_sales := p_actual_cash - v_session.opening_amount - v_movs_total;

  with provided as (
    select coalesce(element->>'metodo', '') as metodo,
           coalesce((element->>'total')::numeric, 0) as total
    from jsonb_array_elements(coalesce(p_actual_payments, '[]'::jsonb)) element
  ),
  by_method as (
    select metodo,
           case
             when metodo = 'cash' then v_actual_cash_sales
             else coalesce(sum(total), 0)
           end as total
    from provided
    where metodo <> ''
    group by metodo
  ),
  with_cash as (
    select 'cash' as metodo, v_actual_cash_sales as total
    union all
    select metodo, total
    from by_method
    where metodo <> 'cash'
  )
  select coalesce(
      jsonb_agg(
        jsonb_build_object('metodo', metodo, 'total', total)
        order by total desc
      ),
      '[]'::jsonb
    )
    into v_actual_breakdown
  from with_cash;

  v_actual_total := coalesce(
    (
      select sum((method->>'total')::numeric)
      from jsonb_array_elements(v_actual_breakdown) method
    ),
    0
  );

  v_cash_difference :=
    (v_session.opening_amount + v_expected_cash_sales + v_movs_total) - p_actual_cash;
  v_sales_difference := v_expected_total - v_actual_total;

  if (abs(v_cash_difference) > v_threshold or abs(v_sales_difference) > v_threshold)
     and (p_notas_cierre is null or btrim(p_notas_cierre) = '') then
    raise exception 'Diferencias mayores a $%.0f requieren nota de cierre', v_threshold;
  end if;

  update public.cash_sessions
  set status                    = 'closed',
      closed_by                 = p_closed_by,
      actual_cash_amount        = p_actual_cash,
      expected_cash_amount      = v_session.opening_amount + v_expected_cash_sales + v_movs_total,
      difference                = v_cash_difference,
      expected_sales_amount     = v_expected_total,
      actual_sales_amount       = v_actual_total,
      sales_difference          = v_sales_difference,
      payment_closure           = jsonb_build_object(
        'expected', v_expected_breakdown,
        'actual', v_actual_breakdown
      ),
      closing_withdrawal_amount = v_closing_withdrawal_amount,
      cash_left_amount          = p_cash_left,
      notas_cierre              = nullif(btrim(coalesce(p_notas_cierre, '')), ''),
      closed_at                 = now()
  where id = p_session_id;

  insert into public.audit_logs (
    tienda_id,
    user_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    p_tienda_id,
    p_closed_by,
    'cash_session.closed',
    'cash_session',
    p_session_id,
    jsonb_build_object(
      'cash_difference', v_cash_difference,
      'sales_difference', v_sales_difference,
      'has_notes', nullif(btrim(coalesce(p_notas_cierre, '')), '') is not null,
      'actual_cash_amount', p_actual_cash,
      'closing_withdrawal_amount', v_closing_withdrawal_amount,
      'cash_left_amount', p_cash_left
    )
  );

  return p_session_id;
end;
$$;

revoke execute on function public.close_cash_session_atomic(
  uuid, uuid, uuid, numeric, numeric, jsonb, text
) from public, anon;

grant execute on function public.close_cash_session_atomic(
  uuid, uuid, uuid, numeric, numeric, jsonb, text
) to authenticated;
