-- =====================================================
-- RPC de caja previas al bloqueo de escrituras directas (paso 1 de 2)
-- =====================================================
-- Se separa de 20261024000300 para desplegar sin corte: primero existen las
-- RPC (no rompe nada), luego se publica el frontend que las usa y por último
-- se revocan las escrituras directas.
--   * add_cash_movement_atomic reemplaza el INSERT directo en cash_movements
--     y exige sesión abierta.
--   * register_expense_atomic pasa a SECURITY DEFINER (antes INVOKER: dependía
--     del INSERT directo en cash_movements) con chequeo explícito de admin y
--     de que categoría/empleado pertenezcan a la tienda.

-- 1. RPC: registrar un movimiento manual en una caja abierta.
create or replace function public.add_cash_movement_atomic(
  p_cash_session_id uuid,
  p_tipo            public.cash_movement_type,
  p_amount          numeric,
  p_motivo          text,
  p_created_by      uuid
)
returns public.cash_movements
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid      uuid := auth.uid();
  v_session  record;
  v_motivo   text := btrim(coalesce(p_motivo, ''));
  v_movement public.cash_movements;
begin
  if v_uid is null or v_uid <> p_created_by then
    raise exception 'No autenticado';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'El monto debe ser mayor a 0';
  end if;

  if length(v_motivo) < 3 or length(v_motivo) > 200 then
    raise exception 'El motivo debe tener entre 3 y 200 caracteres';
  end if;

  select id, tienda_id, status
  into v_session
  from public.cash_sessions
  where id = p_cash_session_id
  for update;

  if v_session.id is null or not exists (
    select 1
    from public.user_tiendas
    where user_id = v_uid
      and tienda_id = v_session.tienda_id
      and is_active = true
  ) then
    raise exception 'Sesión de caja no encontrada';
  end if;

  if v_session.status <> 'open' then
    raise exception 'La sesión de caja ya está cerrada';
  end if;

  insert into public.cash_movements (cash_session_id, tipo, amount, motivo, created_by)
  values (p_cash_session_id, p_tipo, p_amount, v_motivo, v_uid)
  returning * into v_movement;

  return v_movement;
end;
$$;

revoke execute on function public.add_cash_movement_atomic(
  uuid, public.cash_movement_type, numeric, text, uuid
) from public, anon;

grant execute on function public.add_cash_movement_atomic(
  uuid, public.cash_movement_type, numeric, text, uuid
) to authenticated;

comment on function public.add_cash_movement_atomic(
  uuid, public.cash_movement_type, numeric, text, uuid
) is
  'Registra un movimiento manual de caja. Exige usuario activo de la tienda y sesión abierta; reemplaza el INSERT directo en cash_movements.';

-- 2. register_expense_atomic: mismo contrato, ahora DEFINER con los chequeos
--    que antes hacía RLS (expenses es admin_only).
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
)
returns public.expenses
language plpgsql
security definer
set search_path = public, pg_temp
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

  if not exists (
    select 1
    from public.user_tiendas
    where user_id = v_user
      and tienda_id = p_tienda_id
      and rol = 'admin'
      and is_active = true
  ) then
    raise exception 'Solo el admin puede registrar gastos';
  end if;

  if p_monto is null or p_monto <= 0 then
    raise exception 'INVALID_AMOUNT';
  end if;

  if not exists (
    select 1 from public.expense_categories
    where id = p_category_id and tienda_id = p_tienda_id
  ) then
    raise exception 'Categoría de gasto no encontrada';
  end if;

  if p_empleado_id is not null and not exists (
    select 1 from public.empleados
    where id = p_empleado_id and tienda_id = p_tienda_id
  ) then
    raise exception 'Empleado no encontrado';
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
