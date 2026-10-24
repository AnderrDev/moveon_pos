-- =====================================================
-- Ola 1 (2026-10-24): cómo se pagó una entrada de inventario
-- =====================================================
-- La entrada guarda el método de pago de la compra. Si se pagó con efectivo
-- de caja, crea en la misma transacción la salida de caja (cash_out
-- "Compra mercancía: ...") para que el cierre cuadre. La compra NO es gasto:
-- su costo entra a la utilidad cuando se vende (fondo de reinversión).
--
-- p_metodo_pago es opcional (default null): los payloads existentes, incluida
-- la app iOS (fixtures/ios-payloads/register_inventory_entry.json), siguen
-- funcionando sin cambios.
-- =====================================================

alter table public.inventory_movements
  add column if not exists metodo_pago text,
  add column if not exists cash_movement_id uuid references public.cash_movements(id);

alter table public.inventory_movements
  drop constraint if exists inventory_movements_metodo_pago_check;
alter table public.inventory_movements
  add constraint inventory_movements_metodo_pago_check
  check (metodo_pago is null or metodo_pago in ('efectivo_caja', 'efectivo_externo', 'transferencia', 'tarjeta'));

comment on column public.inventory_movements.metodo_pago is
  'Solo entradas: cómo se pagó la compra. null = no registrado.';
comment on column public.inventory_movements.cash_movement_id is
  'Salida de caja creada cuando la compra se pagó con efectivo de caja.';

drop function if exists public.register_inventory_entry_atomic(uuid, uuid, inventory_location, numeric, numeric, text, uuid);

create function public.register_inventory_entry_atomic(
  p_tienda_id uuid,
  p_producto_id uuid,
  p_ubicacion inventory_location,
  p_cantidad numeric,
  p_costo_unitario numeric,
  p_motivo text,
  p_created_by uuid,
  p_metodo_pago text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid               uuid := auth.uid();
  v_product           record;
  v_movement_id       uuid;
  v_normalized_reason text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_metodo            text := nullif(btrim(coalesce(p_metodo_pago, '')), '');
  v_session_id        uuid;
  v_cash_movement_id  uuid;
begin
  if v_uid is null or v_uid <> p_created_by then
    raise exception 'No autenticado';
  end if;

  if not exists (
    select 1
    from public.user_tiendas
    where user_id = v_uid
      and tienda_id = p_tienda_id
      and rol = 'admin'
      and is_active = true
  ) then
    raise exception 'Solo el admin puede registrar entradas de inventario';
  end if;

  if p_cantidad is null or p_cantidad <= 0 then
    raise exception 'La cantidad debe ser mayor a 0';
  end if;

  if p_costo_unitario is not null and p_costo_unitario < 0 then
    raise exception 'El costo unitario no puede ser negativo';
  end if;

  if length(v_normalized_reason) > 200 then
    raise exception 'El motivo no puede superar 200 caracteres';
  end if;

  if v_metodo is not null
     and v_metodo not in ('efectivo_caja', 'efectivo_externo', 'transferencia', 'tarjeta') then
    raise exception 'Método de pago inválido';
  end if;

  if v_metodo = 'efectivo_caja' and coalesce(p_costo_unitario, 0) <= 0 then
    raise exception 'Para pagar con efectivo de caja registra el costo de la compra';
  end if;

  select id, nombre, tipo, costo
  into v_product
  from public.productos
  where id = p_producto_id
    and tienda_id = p_tienda_id
    and deleted_at is null
    and is_active = true
  for update;

  if v_product.id is null then
    raise exception 'Producto no encontrado o inactivo';
  end if;

  if v_product.tipo in ('prepared', 'combo') then
    raise exception 'Este tipo de producto no maneja inventario propio';
  end if;

  if v_metodo = 'efectivo_caja' then
    select id into v_session_id
    from public.cash_sessions
    where tienda_id = p_tienda_id
      and status = 'open'
    order by opened_at desc
    limit 1
    for update;

    if v_session_id is null then
      raise exception 'No hay una caja abierta: abre la caja o elige otro método de pago';
    end if;

    insert into public.cash_movements (cash_session_id, tipo, amount, motivo, created_by)
    values (
      v_session_id,
      'cash_out',
      p_cantidad * p_costo_unitario,
      left('Compra mercancía: ' || v_product.nombre || ' x' || trim_scale(p_cantidad)::text, 200),
      v_uid
    )
    returning id into v_cash_movement_id;
  end if;

  insert into public.inventory_movements (
    tienda_id,
    producto_id,
    tipo,
    ubicacion,
    cantidad,
    costo_unitario,
    motivo,
    created_by,
    metodo_pago,
    cash_movement_id
  )
  values (
    p_tienda_id,
    p_producto_id,
    'entry',
    p_ubicacion,
    p_cantidad,
    p_costo_unitario,
    v_normalized_reason,
    p_created_by,
    v_metodo,
    v_cash_movement_id
  )
  returning id into v_movement_id;

  if p_costo_unitario is not null then
    update public.productos
    set costo = p_costo_unitario
    where id = p_producto_id and tienda_id = p_tienda_id;
  end if;

  insert into public.audit_logs (
    tienda_id,
    user_id,
    action,
    entity_type,
    entity_id,
    entity_label,
    changes
  )
  values (
    p_tienda_id,
    p_created_by,
    'inventory.entry_registered',
    'inventory_movement',
    v_movement_id,
    v_product.nombre,
    jsonb_build_object(
      'producto_id',           p_producto_id,
      'cantidad',              p_cantidad,
      'ubicacion',             p_ubicacion,
      'costo_unitario',        p_costo_unitario,
      'costo_total',           case when p_costo_unitario is null then null else p_cantidad * p_costo_unitario end,
      'old_product_cost',      v_product.costo,
      'new_product_cost',      case when p_costo_unitario is null then v_product.costo else p_costo_unitario end,
      'product_cost_updated',  p_costo_unitario is not null,
      'motivo',                v_normalized_reason,
      'metodo_pago',           v_metodo,
      'cash_movement_id',      v_cash_movement_id
    )
  );

  return v_movement_id;
end;
$$;

revoke all on function public.register_inventory_entry_atomic(uuid, uuid, inventory_location, numeric, numeric, text, uuid, text) from public, anon;
grant execute on function public.register_inventory_entry_atomic(uuid, uuid, inventory_location, numeric, numeric, text, uuid, text) to authenticated;

-- -----------------------------------------------------
-- correct_inventory_entry_cost_atomic: si la compra salió de una caja que
-- sigue abierta, la salida de caja se ajusta al nuevo total. Con la caja ya
-- cerrada el arqueo es histórico y no se toca (queda en la auditoría).
-- -----------------------------------------------------
create or replace function public.correct_inventory_entry_cost_atomic(
  p_movement_id uuid,
  p_tienda_id uuid,
  p_new_cost numeric,
  p_update_product_cost boolean,
  p_corrected_by uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid          uuid := auth.uid();
  v_movement     record;
  v_product      record;
  v_reason       text := btrim(coalesce(p_reason, ''));
  v_update_product_cost boolean := coalesce(p_update_product_cost, false);
  v_cash_synced  boolean := false;
begin
  if v_uid is null or v_uid <> p_corrected_by then
    raise exception 'No autenticado';
  end if;

  if not exists (
    select 1
    from public.user_tiendas
    where user_id = v_uid
      and tienda_id = p_tienda_id
      and rol = 'admin'
      and is_active = true
  ) then
    raise exception 'Solo el admin puede corregir costos de inventario';
  end if;

  if p_new_cost is null or p_new_cost <= 0 then
    raise exception 'El nuevo costo debe ser mayor a 0';
  end if;

  if length(v_reason) < 10 then
    raise exception 'El motivo debe tener al menos 10 caracteres';
  end if;

  if length(v_reason) > 200 then
    raise exception 'El motivo no puede superar 200 caracteres';
  end if;

  select *
  into v_movement
  from public.inventory_movements
  where id = p_movement_id
    and tienda_id = p_tienda_id
  for update;

  if v_movement.id is null then
    raise exception 'Movimiento no encontrado';
  end if;

  if v_movement.tipo <> 'entry' then
    raise exception 'Solo se puede corregir el costo de una entrada';
  end if;

  select id, nombre, costo
  into v_product
  from public.productos
  where id = v_movement.producto_id
    and tienda_id = p_tienda_id
  for update;

  if v_product.id is null then
    raise exception 'Producto no encontrado';
  end if;

  if v_movement.costo_unitario is not distinct from p_new_cost
     and (not v_update_product_cost or v_product.costo is not distinct from p_new_cost) then
    raise exception 'El nuevo costo es igual al actual';
  end if;

  update public.inventory_movements
  set costo_unitario = p_new_cost
  where id = p_movement_id;

  if v_update_product_cost then
    update public.productos
    set costo = p_new_cost
    where id = v_product.id;
  end if;

  if v_movement.cash_movement_id is not null then
    update public.cash_movements cm
    set amount = v_movement.cantidad * p_new_cost
    from public.cash_sessions cs
    where cm.id = v_movement.cash_movement_id
      and cs.id = cm.cash_session_id
      and cs.status = 'open'
      and cm.status = 'active';
    v_cash_synced := found;
  end if;

  insert into public.audit_logs (
    tienda_id,
    user_id,
    action,
    entity_type,
    entity_id,
    entity_label,
    changes
  )
  values (
    p_tienda_id,
    p_corrected_by,
    'inventory.entry_cost_corrected',
    'inventory_movement',
    p_movement_id,
    v_product.nombre,
    jsonb_build_object(
      'producto_id',          v_movement.producto_id,
      'cantidad',             v_movement.cantidad,
      'old_unit_cost',        v_movement.costo_unitario,
      'new_unit_cost',        p_new_cost,
      'old_total_cost',       case when v_movement.costo_unitario is null then null else v_movement.cantidad * v_movement.costo_unitario end,
      'new_total_cost',       v_movement.cantidad * p_new_cost,
      'old_product_cost',     v_product.costo,
      'new_product_cost',     case when v_update_product_cost then p_new_cost else v_product.costo end,
      'product_cost_updated', v_update_product_cost,
      'cash_movement_id',     v_movement.cash_movement_id,
      'cash_movement_synced', v_cash_synced,
      'reason',               v_reason
    )
  );

  return p_movement_id;
end;
$$;
