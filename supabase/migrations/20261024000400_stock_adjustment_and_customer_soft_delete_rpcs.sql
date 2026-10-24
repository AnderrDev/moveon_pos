-- =====================================================
-- Ajustes de stock por RPC + borrado lógico de clientes (paso 1 de 2)
-- =====================================================
-- Auditoría 2026-10-24, P0 #2 y #4. Aditiva: no rompe el frontend publicado.
-- El paso 2 (20261024000500) revoca las escrituras directas cuando el
-- frontend ya use estas RPC.
--
--   * adjust_stock_atomic reemplaza el INSERT directo de `adjustment` en
--     inventory_movements: el cliente ya no elige tipo, referencia ni autor.
--   * Clientes: `deleted_at` / `deleted_by` + delete_customer_atomic. Borrar
--     ya no arrastra en cascada el historial de fidelización ni desvincula
--     las ventas; el cliente sale de los listados y deja de acumular sellos
--     (activo = false, que también lo oculta de storefront_club_progress).
--   * Los índices únicos de celular/documento ignoran clientes eliminados
--     (mismos nombres: mapWriteError del frontend los reconoce).
--   * No se pueden asociar ventas nuevas a un cliente eliminado.

-- 1. Ajuste de stock.
create or replace function public.adjust_stock_atomic(
  p_tienda_id      uuid,
  p_producto_id    uuid,
  p_ubicacion      public.inventory_location,
  p_cantidad_delta numeric,
  p_motivo         text,
  p_created_by     uuid
)
returns public.inventory_movements
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid      uuid := auth.uid();
  v_product  record;
  v_motivo   text := btrim(coalesce(p_motivo, ''));
  v_movement public.inventory_movements;
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
    raise exception 'Solo el admin puede ajustar inventario';
  end if;

  if p_cantidad_delta is null or p_cantidad_delta = 0 then
    raise exception 'El ajuste no puede ser cero';
  end if;

  if length(v_motivo) < 3 or length(v_motivo) > 200 then
    raise exception 'El motivo debe tener entre 3 y 200 caracteres';
  end if;

  -- Bloquea el producto para serializar ajustes concurrentes del mismo ítem.
  select id, tipo
  into v_product
  from public.productos
  where id = p_producto_id
    and tienda_id = p_tienda_id
    and deleted_at is null
  for update;

  if v_product.id is null then
    raise exception 'Producto no encontrado';
  end if;

  if v_product.tipo in ('prepared', 'combo') then
    raise exception 'Este tipo de producto no maneja inventario propio';
  end if;

  -- tr_audit_inventory_adjustment registra la auditoría del ajuste.
  insert into public.inventory_movements (
    tienda_id, producto_id, tipo, ubicacion, cantidad, motivo, created_by
  ) values (
    p_tienda_id, p_producto_id, 'adjustment', p_ubicacion, p_cantidad_delta, v_motivo, v_uid
  )
  returning * into v_movement;

  return v_movement;
end;
$$;

revoke execute on function public.adjust_stock_atomic(
  uuid, uuid, public.inventory_location, numeric, text, uuid
) from public, anon;

grant execute on function public.adjust_stock_atomic(
  uuid, uuid, public.inventory_location, numeric, text, uuid
) to authenticated;

comment on function public.adjust_stock_atomic(
  uuid, uuid, public.inventory_location, numeric, text, uuid
) is
  'Ajuste manual de stock (tipo adjustment). Solo admin activo de la tienda; motivo obligatorio. Reemplaza el INSERT directo en inventory_movements.';

-- 2. Clientes: borrado lógico.
alter table public.clientes
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid;

comment on column public.clientes.deleted_at is
  'Borrado lógico (delete_customer_atomic). El cliente sale de los listados y deja de acumular sellos; su historial se conserva.';

drop index if exists public.ux_clientes_celular_normalizado;
create unique index ux_clientes_celular_normalizado
  on public.clientes (tienda_id, celular_normalizado)
  where celular_normalizado is not null and deleted_at is null;

drop index if exists public.ux_clientes_documento;
create unique index ux_clientes_documento
  on public.clientes (tienda_id, tipo_documento, numero_documento)
  where numero_documento is not null and deleted_at is null;

create or replace function public.delete_customer_atomic(
  p_cliente_id uuid,
  p_tienda_id  uuid,
  p_deleted_by uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid     uuid := auth.uid();
  v_cliente record;
begin
  if v_uid is null or v_uid <> p_deleted_by then
    raise exception 'No autenticado';
  end if;

  -- Misma regla de negocio que antes: cualquier usuario activo de la tienda.
  if not exists (
    select 1
    from public.user_tiendas
    where user_id = v_uid
      and tienda_id = p_tienda_id
      and is_active = true
  ) then
    raise exception 'Cliente no encontrado';
  end if;

  select id, nombre, numero_documento, celular_normalizado
  into v_cliente
  from public.clientes
  where id = p_cliente_id
    and tienda_id = p_tienda_id
    and deleted_at is null
  for update;

  if v_cliente.id is null then
    raise exception 'Cliente no encontrado';
  end if;

  update public.clientes
  set deleted_at = now(),
      deleted_by = v_uid,
      activo     = false
  where id = p_cliente_id;

  insert into public.audit_logs (
    tienda_id, user_id, action, entity_type, entity_id, entity_label, changes
  ) values (
    p_tienda_id, v_uid, 'customer.deleted', 'cliente', p_cliente_id, v_cliente.nombre,
    jsonb_build_object(
      'numero_documento',    v_cliente.numero_documento,
      'celular_normalizado', v_cliente.celular_normalizado,
      'soft_delete',         true
    )
  );

  return p_cliente_id;
end;
$$;

revoke execute on function public.delete_customer_atomic(uuid, uuid, uuid) from public, anon;
grant execute on function public.delete_customer_atomic(uuid, uuid, uuid) to authenticated;

comment on function public.delete_customer_atomic(uuid, uuid, uuid) is
  'Borrado lógico de un cliente: marca deleted_at/deleted_by y activo=false, conserva ventas y fidelización, y audita.';

-- 3. Ventas: no asociar clientes eliminados (crear venta o corregir cliente).
create or replace function public.enforce_sale_customer_not_deleted()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.cliente_id is not null
     and (tg_op = 'INSERT' or new.cliente_id is distinct from old.cliente_id)
     and exists (
       select 1 from public.clientes
       where id = new.cliente_id and deleted_at is not null
     ) then
    raise exception 'El cliente fue eliminado';
  end if;
  return new;
end;
$$;

drop trigger if exists sales_enforce_customer_not_deleted on public.sales;
create trigger sales_enforce_customer_not_deleted
  before insert or update of cliente_id on public.sales
  for each row execute function public.enforce_sale_customer_not_deleted();
