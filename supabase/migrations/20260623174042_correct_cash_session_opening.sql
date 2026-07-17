-- =====================================================
-- Corrección de apertura de caja (cash_sessions.opening_amount)
-- =====================================================
-- Origen: incidente 2026-06-22 — la caja se abrió con un monto incorrecto.
-- La única forma de "corregir" la apertura era editar la fila directamente
-- en la base de datos (sin auditoría), o crear/anular movimientos de caja
-- manuales que no resuelven el problema: un `cash_movement` neta sobre
-- `v_movs_total` ENCIMA de `opening_amount` (RN-C03) — estructuralmente no
-- puede representar "el monto de apertura en sí estaba mal".
--
-- Esta migración agrega `correct_cash_session_opening_atomic`, espejo de
-- `void_cash_movement_atomic` (mismo formato de auditoría antes/después en
-- `audit_logs.metadata`), con una divergencia deliberada: el gate de permisos
-- es el de "caja compartida" (PLAN-19, igual que `close_cash_session_atomic`)
-- y NO el gate admin-only de `void_cash_movement_atomic` — cualquier usuario
-- activo de la tienda puede corregir la apertura mientras la sesión sigue
-- `open`. No se restringe a `opened_by` ni a admin: este es un negocio de
-- 1 sede / 1 operador a la vez, y restringir a admin reintroduciría la
-- fricción que causó el workaround manual del incidente.
--
-- La corrección solo modifica `cash_sessions.opening_amount`. Nunca toca
-- `cash_movements`, `sales` ni `payments`. `close_cash_session_atomic` no se
-- modifica: lee `opening_amount` en vivo de `cash_sessions` al cerrar, así
-- que la corrección se refleja automáticamente en el cuadre del cierre.
-- =====================================================

create or replace function public.correct_cash_session_opening_atomic(
  p_session_id    uuid,
  p_tienda_id     uuid,
  p_new_amount    numeric,
  p_corrected_by  uuid,
  p_reason        text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid          uuid := auth.uid();
  v_session      record;
  v_old_amount   numeric;
begin
  if v_uid is null or v_uid <> p_corrected_by then
    raise exception 'No autenticado';
  end if;

  if p_new_amount is null or p_new_amount < 0 then
    raise exception 'El monto de apertura no puede ser negativo';
  end if;

  if length(btrim(coalesce(p_reason, ''))) < 10 then
    raise exception 'El motivo debe tener al menos 10 caracteres';
  end if;

  select * into v_session
  from public.cash_sessions
  where id = p_session_id and tienda_id = p_tienda_id
  for update;

  if v_session.id is null then
    raise exception 'Sesion no encontrada';
  end if;

  if v_session.status <> 'open' then
    raise exception 'Solo se puede corregir la apertura mientras la caja esta abierta';
  end if;

  -- Caja compartida (PLAN-19): cualquier usuario activo de la tienda puede
  -- corregir, no solo quien la abrio (mismo gate que close_cash_session_atomic).
  if not exists (
    select 1 from public.user_tiendas
    where user_id = v_uid and tienda_id = p_tienda_id and is_active = true
  ) then
    raise exception 'Solo un usuario activo de la tienda puede corregir esta caja';
  end if;

  v_old_amount := v_session.opening_amount;

  if v_old_amount = p_new_amount then
    raise exception 'El nuevo monto es igual al actual';
  end if;

  update public.cash_sessions
  set opening_amount = p_new_amount
  where id = p_session_id;

  insert into public.audit_logs (tienda_id, user_id, action, entity_type, entity_id, metadata)
  values (
    p_tienda_id, p_corrected_by, 'cash_session.opening_corrected', 'cash_session', p_session_id,
    jsonb_build_object(
      'old_amount', v_old_amount,
      'new_amount', p_new_amount,
      'reason',     btrim(p_reason)
    )
  );

  return p_session_id;
end;
$$;

revoke execute on function public.correct_cash_session_opening_atomic(uuid, uuid, numeric, uuid, text) from public, anon;
grant  execute on function public.correct_cash_session_opening_atomic(uuid, uuid, numeric, uuid, text) to authenticated;
