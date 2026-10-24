-- =====================================================
-- Ola 1 (2026-10-24): gastos de caja ↔ finanzas sincronizados
-- =====================================================
-- 1. Un movimiento "Gasto" registrado desde Caja crea su gasto en Finanzas
--    (categoría "Gastos de caja"). Antes solo existía en caja y la utilidad
--    neta de Finanzas no lo restaba.
-- 2. Anular un gasto anula su salida de caja, y anular la salida anula el
--    gasto. Corregir el monto de la salida corrige el gasto.
-- 3. `expenses` deja de aceptar escrituras directas: todo pasa por RPC.
-- =====================================================

-- Categoría por defecto de los gastos hechos desde caja. Se crea por tienda
-- la primera vez que se necesita (uso interno de las RPC, no del cliente).
create or replace function public.ensure_cash_expense_category(p_tienda_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  insert into public.expense_categories (tienda_id, nombre, slug, tipo)
  values (p_tienda_id, 'Gastos de caja', 'caja', 'variable')
  on conflict (tienda_id, slug) do nothing;

  select id into v_id
  from public.expense_categories
  where tienda_id = p_tienda_id and slug = 'caja';

  return v_id;
end;
$$;

revoke all on function public.ensure_cash_expense_category(uuid) from public, anon, authenticated;

-- -----------------------------------------------------
-- add_cash_movement_atomic: tipo 'expense' también crea el gasto.
-- -----------------------------------------------------
create or replace function public.add_cash_movement_atomic(
  p_cash_session_id uuid,
  p_tipo cash_movement_type,
  p_amount numeric,
  p_motivo text,
  p_created_by uuid
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
  v_tz       text;
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

  if p_tipo = 'expense' then
    select coalesce(timezone, 'America/Bogota') into v_tz
    from public.tiendas where id = v_session.tienda_id;

    insert into public.expenses (
      tienda_id, category_id, concepto, monto, fecha_gasto,
      metodo_pago, cash_movement_id, created_by
    ) values (
      v_session.tienda_id,
      public.ensure_cash_expense_category(v_session.tienda_id),
      v_motivo,
      p_amount,
      (now() at time zone coalesce(v_tz, 'America/Bogota'))::date,
      'efectivo_caja',
      v_movement.id,
      v_uid
    );
  end if;

  return v_movement;
end;
$$;

-- -----------------------------------------------------
-- void_cash_movement_atomic: también anula el gasto enlazado.
-- -----------------------------------------------------
create or replace function public.void_cash_movement_atomic(
  p_movement_id uuid,
  p_tienda_id uuid,
  p_voided_by uuid,
  p_voided_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_movement_id uuid;
  v_expense_id  uuid;
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

  update public.expenses
  set status        = 'voided',
      voided_by     = p_voided_by,
      voided_at     = now(),
      voided_reason = p_voided_reason
  where cash_movement_id = p_movement_id
    and tienda_id = p_tienda_id
    and status = 'active'
  returning id into v_expense_id;

  insert into public.audit_logs (tienda_id, user_id, action, entity_type, entity_id, metadata)
  values (
    p_tienda_id, p_voided_by, 'cash_movement.voided', 'cash_movement', p_movement_id,
    jsonb_build_object('reason', p_voided_reason, 'expense_id', v_expense_id)
  );

  return v_movement_id;
end;
$$;

-- -----------------------------------------------------
-- correct_cash_movement_atomic: el gasto enlazado sigue al monto corregido.
-- -----------------------------------------------------
create or replace function public.correct_cash_movement_atomic(
  p_movement_id uuid,
  p_tienda_id uuid,
  p_new_amount numeric,
  p_new_motivo text,
  p_corrected_by uuid,
  p_reason text
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
  v_expense_id  uuid;
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

  -- Los gastos de Finanzas pagados con caja guardan la salida como
  -- "Gasto: <concepto>"; se quita el prefijo para no duplicarlo.
  update public.expenses
  set monto    = p_new_amount,
      concepto = regexp_replace(v_new_motivo, '^Gasto: ', '')
  where cash_movement_id = p_movement_id
    and tienda_id = p_tienda_id
    and status = 'active'
  returning id into v_expense_id;

  insert into public.audit_logs (tienda_id, user_id, action, entity_type, entity_id, metadata)
  values (
    p_tienda_id, p_corrected_by, 'cash_movement.corrected', 'cash_movement', p_movement_id,
    jsonb_build_object(
      'old_amount', v_movement.amount,
      'new_amount', p_new_amount,
      'old_motivo', v_movement.motivo,
      'new_motivo', v_new_motivo,
      'tipo',       v_movement.tipo,
      'reason',     btrim(p_reason),
      'expense_id', v_expense_id
    )
  );

  return p_movement_id;
end;
$$;

-- -----------------------------------------------------
-- void_expense_atomic: anula el gasto y su salida de caja en una transacción.
-- Reemplaza el UPDATE directo que hacía el cliente.
-- -----------------------------------------------------
create or replace function public.void_expense_atomic(
  p_expense_id uuid,
  p_tienda_id uuid,
  p_reason text
)
returns public.expenses
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid         uuid := auth.uid();
  v_reason      text := btrim(coalesce(p_reason, ''));
  v_expense     public.expenses;
  v_movement_id uuid;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  if not exists (
    select 1 from public.user_tiendas
    where user_id = v_uid
      and tienda_id = p_tienda_id
      and rol = 'admin'
      and is_active = true
  ) then
    raise exception 'Solo el admin puede anular gastos';
  end if;

  if length(v_reason) < 10 or length(v_reason) > 300 then
    raise exception 'El motivo debe tener entre 10 y 300 caracteres';
  end if;

  update public.expenses
  set status        = 'voided',
      voided_by     = v_uid,
      voided_at     = now(),
      voided_reason = v_reason
  where id = p_expense_id
    and tienda_id = p_tienda_id
    and status = 'active'
  returning * into v_expense;

  if v_expense.id is null then
    raise exception 'El gasto no existe o ya estaba anulado';
  end if;

  if v_expense.cash_movement_id is not null then
    update public.cash_movements
    set status        = 'voided',
        voided_by     = v_uid,
        voided_at     = now(),
        voided_reason = 'Gasto anulado: ' || v_reason
    where id = v_expense.cash_movement_id
      and status = 'active'
    returning id into v_movement_id;
  end if;

  insert into public.audit_logs (tienda_id, user_id, action, entity_type, entity_id, entity_label, metadata)
  values (
    p_tienda_id, v_uid, 'expense.voided', 'expense', v_expense.id, v_expense.concepto,
    jsonb_build_object(
      'reason',            v_reason,
      'monto',             v_expense.monto,
      'cash_movement_id',  v_movement_id
    )
  );

  return v_expense;
end;
$$;

revoke all on function public.void_expense_atomic(uuid, uuid, text) from public, anon;
grant execute on function public.void_expense_atomic(uuid, uuid, text) to authenticated;

-- Escrituras de gastos solo vía RPC (register_expense_atomic, void_expense_atomic,
-- add_cash_movement_atomic y las de caja). Lectura sigue por RLS admin_only.
revoke insert, update, delete, truncate on public.expenses from anon, authenticated;
