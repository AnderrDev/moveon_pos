-- ============================================================
-- RPC register_expense_atomic — Módulo de Finanzas
-- Registra un gasto y, si se paga con efectivo de la caja abierta,
-- crea el movimiento de caja (tipo 'expense') en la misma transacción
-- para que el cierre de caja siga cuadrando.
-- Security invoker: la autorización la aplican las policies RLS
-- (expenses es solo-admin; cash_movements exige pertenecer a la tienda).
-- Los parámetros opcionales van al final con default null para que
-- los tipos generados por supabase los marquen como opcionales.
-- ============================================================

create or replace function public.register_expense_atomic(
  p_tienda_id   uuid,
  p_category_id uuid,
  p_concepto    text,
  p_monto       numeric,
  p_metodo_pago text,
  p_empleado_id uuid default null,
  p_notas       text default null,
  p_fecha_gasto date default null,
  p_periodo     text default null
) returns public.expenses
language plpgsql
security invoker
as $$
declare
  v_user        uuid := auth.uid();
  v_session_id  uuid;
  v_movement_id uuid;
  v_expense     public.expenses;
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  if p_monto is null or p_monto <= 0 then
    raise exception 'INVALID_AMOUNT';
  end if;

  if p_metodo_pago = 'efectivo_caja' then
    select id into v_session_id
    from public.cash_sessions
    where tienda_id = p_tienda_id
      and status = 'open'
    order by opened_at desc
    limit 1;

    if v_session_id is null then
      raise exception 'NO_OPEN_CASH_SESSION';
    end if;

    insert into public.cash_movements (cash_session_id, tipo, amount, motivo, created_by)
    values (v_session_id, 'expense', p_monto, 'Gasto: ' || p_concepto, v_user)
    returning id into v_movement_id;
  end if;

  insert into public.expenses (
    tienda_id, category_id, empleado_id, concepto, notas, monto,
    fecha_gasto, metodo_pago, cash_movement_id, periodo, created_by
  ) values (
    p_tienda_id, p_category_id, p_empleado_id, p_concepto, p_notas, p_monto,
    coalesce(p_fecha_gasto, current_date), p_metodo_pago, v_movement_id, p_periodo, v_user
  )
  returning * into v_expense;

  return v_expense;
end;
$$;

revoke execute on function public.register_expense_atomic(
  uuid, uuid, text, numeric, text, uuid, text, date, text
) from public, anon;

grant execute on function public.register_expense_atomic(
  uuid, uuid, text, numeric, text, uuid, text, date, text
) to authenticated;
