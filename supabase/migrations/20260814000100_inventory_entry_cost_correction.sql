-- =====================================================
-- Entradas de inventario con costo vigente + corrección auditada
-- =====================================================
-- Una entrada con costo representa una compra de mercancía:
--   * suma stock mediante inventory_movements;
--   * alimenta el fondo de reinversión con cantidad * costo_unitario;
--   * actualiza productos.costo para costear correctamente ventas futuras.
--
-- Si el costo se digitó mal, correct_inventory_entry_cost_atomic corrige solo
-- ese dato (nunca cantidad/ubicación) y conserva old/new/reason en audit_logs.
-- Actualizar el costo vigente del producto durante una corrección es una
-- decisión explícita del usuario, porque la entrada corregida puede ser vieja.

-- La policy histórica permitía cualquier escritura a todo usuario activo de
-- la tienda. Lectura sigue compartida, pero las inserciones manuales quedan
-- limitadas a admin; los flujos de venta/anulación/traslado usan RPC DEFINER.
drop policy if exists tenant_isolation on public.inventory_movements;
drop policy if exists inventory_movements_select on public.inventory_movements;
drop policy if exists inventory_movements_admin_insert on public.inventory_movements;

create policy inventory_movements_select
  on public.inventory_movements
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.user_tiendas ut
      where ut.user_id = (select auth.uid())
        and ut.tienda_id = inventory_movements.tienda_id
        and ut.is_active = true
    )
  );

create policy inventory_movements_admin_insert
  on public.inventory_movements
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.user_tiendas ut
      where ut.user_id = (select auth.uid())
        and ut.tienda_id = inventory_movements.tienda_id
        and ut.is_active = true
        and ut.rol = 'admin'
    )
  );

create or replace function public.register_inventory_entry_atomic(
  p_tienda_id      uuid,
  p_producto_id    uuid,
  p_ubicacion      public.inventory_location,
  p_cantidad       numeric,
  p_costo_unitario numeric,
  p_motivo         text,
  p_created_by     uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid              uuid := auth.uid();
  v_product          record;
  v_movement_id      uuid;
  v_normalized_reason text := nullif(btrim(coalesce(p_motivo, '')), '');
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

  insert into public.inventory_movements (
    tienda_id,
    producto_id,
    tipo,
    ubicacion,
    cantidad,
    costo_unitario,
    motivo,
    created_by
  )
  values (
    p_tienda_id,
    p_producto_id,
    'entry',
    p_ubicacion,
    p_cantidad,
    p_costo_unitario,
    v_normalized_reason,
    p_created_by
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
    v_movement_id::text,
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
      'motivo',                v_normalized_reason
    )
  );

  return v_movement_id;
end;
$$;

revoke execute on function public.register_inventory_entry_atomic(
  uuid, uuid, public.inventory_location, numeric, numeric, text, uuid
) from public, anon;

grant execute on function public.register_inventory_entry_atomic(
  uuid, uuid, public.inventory_location, numeric, numeric, text, uuid
) to authenticated;

comment on function public.register_inventory_entry_atomic(
  uuid, uuid, public.inventory_location, numeric, numeric, text, uuid
) is
  'Registra una entrada de inventario y, si trae costo, actualiza productos.costo en la misma transacción. Solo admin; deja audit_logs.';


create or replace function public.correct_inventory_entry_cost_atomic(
  p_movement_id        uuid,
  p_tienda_id          uuid,
  p_new_cost           numeric,
  p_update_product_cost boolean,
  p_corrected_by       uuid,
  p_reason             text
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
    p_movement_id::text,
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
      'reason',               v_reason
    )
  );

  return p_movement_id;
end;
$$;

revoke execute on function public.correct_inventory_entry_cost_atomic(
  uuid, uuid, numeric, boolean, uuid, text
) from public, anon;

grant execute on function public.correct_inventory_entry_cost_atomic(
  uuid, uuid, numeric, boolean, uuid, text
) to authenticated;

comment on function public.correct_inventory_entry_cost_atomic(
  uuid, uuid, numeric, boolean, uuid, text
) is
  'Corrige únicamente costo_unitario de un movimiento entry. Puede actualizar productos.costo de forma explícita y siempre registra old/new/reason en audit_logs.';
