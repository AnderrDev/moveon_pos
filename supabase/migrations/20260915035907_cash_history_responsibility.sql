-- Snapshot legible de responsabilidad; no se usa para autorizar.
alter table public.cash_sessions add column closed_by_email text;
update public.cash_sessions cs set closed_by_email = u.email
from auth.users u where cs.closed_by = u.id and cs.closed_by_email is null;
create index cash_sessions_history_idx on public.cash_sessions (tienda_id, closed_at desc, id desc) where status = 'closed';
create index cash_sessions_closer_history_idx on public.cash_sessions (tienda_id, closed_by, closed_at desc) where status = 'closed';




create or replace function public.close_cash_session_atomic(
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
  v_closed_by_email           text;
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

  v_closed_by_email := nullif(auth.jwt() ->> 'email', '');
  if v_closed_by_email is null then
    select email into v_closed_by_email from auth.users where id = v_uid;
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
      closed_by_email           = v_closed_by_email,
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

create function public.list_cash_session_closers(p_tienda_id uuid)
returns table(user_id uuid, email text)
language sql stable security invoker
set search_path = public, pg_temp
as $$
  select distinct cs.closed_by, cs.closed_by_email
  from public.cash_sessions cs
  where cs.tienda_id = p_tienda_id and cs.status = 'closed'
    and cs.closed_by is not null and cs.closed_by_email is not null
  order by cs.closed_by_email, cs.closed_by;
$$;
revoke execute on function public.list_cash_session_closers(uuid) from public, anon;
grant execute on function public.list_cash_session_closers(uuid) to authenticated;

-- El snapshot tampoco puede fabricarse al abrir una caja.
drop policy if exists cash_sessions_open_insert_only on public.cash_sessions;
create policy cash_sessions_open_insert_only on public.cash_sessions
as restrictive for insert to authenticated with check (
 status = 'open' and opened_by = (select auth.uid()) and closed_by is null
 and closed_by_email is null and expected_cash_amount is null and actual_cash_amount is null
 and closing_withdrawal_amount is null and cash_left_amount is null and difference is null
 and expected_sales_amount is null and actual_sales_amount is null and sales_difference is null
 and payment_closure = '{}'::jsonb and notas_cierre is null and closed_at is null
);
