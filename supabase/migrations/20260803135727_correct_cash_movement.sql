-- =====================================================
-- Corrección de un movimiento de caja (monto y motivo)
-- =====================================================
-- Pedido del dueño (2026-08-03): "editar los movimientos del turno por si se
-- equivoca alguien". Hasta hoy la única salida ante un error era anular el
-- movimiento (RN-C12, `void_cash_movement_atomic`) y volver a registrarlo —
-- pero anular es **admin-only**, así que un cajero que teclea un cero de más
-- queda trabado hasta que aparezca un admin. Ese es el problema real.
--
-- Esta migración agrega `correct_cash_movement_atomic`, espejo de
-- `correct_cash_session_opening_atomic` (RN-C13) y con su mismo criterio:
--
--   * Gate de "caja compartida" (PLAN-19), NO admin-only: corregir no borra
--     rastro — el valor viejo y el nuevo quedan ambos en `audit_logs`. El
--     candado de admin se justifica para anular (borra un registro del
--     turno), no para arreglar un monto mal tecleado.
--   * Solo mientras la sesión está `open`: un turno cerrado ya tiene su
--     `difference` calculado y firmado; corregir después lo dejaría mintiendo.
--   * Solo `amount` y `motivo`. El `tipo` NO se toca (decisión del dueño):
--     cambiar un `cash_in` por un `cash_out` invierte el signo del cuadre y es
--     más honesto anular y registrar de nuevo.
--   * Motivo de la corrección obligatorio (mínimo 10 caracteres, igual que
--     anular y que corregir la apertura) y se rechazan los no-ops.
--
-- `close_cash_session_atomic` no se modifica: suma `cash_movements` en vivo al
-- cerrar, así que la corrección se refleja sola en el cuadre.
-- =====================================================

create or replace function public.correct_cash_movement_atomic(
  p_movement_id   uuid,
  p_tienda_id     uuid,
  p_new_amount    numeric,
  p_new_motivo    text,
  p_corrected_by  uuid,
  p_reason        text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid         uuid := auth.uid();
  v_movement    record;
  v_session     record;
  v_new_motivo  text := btrim(coalesce(p_new_motivo, ''));
begin
  if v_uid is null or v_uid <> p_corrected_by then
    raise exception 'No autenticado';
  end if;

  if p_new_amount is null or p_new_amount <= 0 then
    raise exception 'El monto debe ser mayor a 0';
  end if;

  if length(v_new_motivo) < 3 then
    raise exception 'Describe el motivo del movimiento';
  end if;

  if length(btrim(coalesce(p_reason, ''))) < 10 then
    raise exception 'El motivo de la correccion debe tener al menos 10 caracteres';
  end if;

  select * into v_movement
  from public.cash_movements
  where id = p_movement_id
  for update;

  if v_movement.id is null then
    raise exception 'Movimiento no encontrado';
  end if;

  if v_movement.status <> 'active' then
    raise exception 'No se puede corregir un movimiento anulado';
  end if;

  select * into v_session
  from public.cash_sessions
  where id = v_movement.cash_session_id and tienda_id = p_tienda_id;

  if v_session.id is null then
    raise exception 'Movimiento no encontrado';
  end if;

  if v_session.status <> 'open' then
    raise exception 'Solo se pueden corregir movimientos de la caja abierta';
  end if;

  -- Caja compartida (PLAN-19): cualquier usuario activo de la tienda, igual
  -- que corregir la apertura (RN-C13). No se restringe a `created_by`.
  if not exists (
    select 1 from public.user_tiendas
    where user_id = v_uid and tienda_id = p_tienda_id and is_active = true
  ) then
    raise exception 'Solo un usuario activo de la tienda puede corregir este movimiento';
  end if;

  if v_movement.amount = p_new_amount and v_movement.motivo = v_new_motivo then
    raise exception 'El movimiento no cambio';
  end if;

  update public.cash_movements
  set amount = p_new_amount,
      motivo = v_new_motivo
  where id = p_movement_id;

  insert into public.audit_logs (tienda_id, user_id, action, entity_type, entity_id, metadata)
  values (
    p_tienda_id, p_corrected_by, 'cash_movement.corrected', 'cash_movement', p_movement_id,
    jsonb_build_object(
      'old_amount', v_movement.amount,
      'new_amount', p_new_amount,
      'old_motivo', v_movement.motivo,
      'new_motivo', v_new_motivo,
      'tipo',       v_movement.tipo,
      'reason',     btrim(p_reason)
    )
  );

  return p_movement_id;
end;
$$;

revoke execute on function public.correct_cash_movement_atomic(uuid, uuid, numeric, text, uuid, text) from public, anon;
grant  execute on function public.correct_cash_movement_atomic(uuid, uuid, numeric, text, uuid, text) to authenticated;
