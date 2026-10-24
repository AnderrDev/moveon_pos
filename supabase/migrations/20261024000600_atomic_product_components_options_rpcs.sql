-- =====================================================
-- Guardar recetas y opciones de producto de forma atómica (paso 1 de 2)
-- =====================================================
-- Auditoría 2026-10-24, P1 #8. Aditiva: no rompe el frontend publicado.
--
-- Antes el cliente guardaba en varias peticiones sueltas:
--   * componentes: DELETE de todos + INSERT de los nuevos → un fallo entre
--     ambos dejaba el preparado/combo sin receta (la venta no descontaba).
--   * opciones: SELECT + UPSERT + UPDATE (desactivar quitadas) → un fallo a
--     mitad dejaba opciones parciales. Además, al CAMBIAR la opción por
--     defecto, el upsert podía chocar con `ux_product_options_default`
--     (una sola por grupo) mientras ambas filas seguían marcadas.
--
-- Cada RPC hace todo en una transacción, valida contra la tienda y deja
-- auditoría. El paso 2 (20261024000700) revoca la escritura directa.

-- 1. Componentes fijos de un preparado / productos incluidos de un combo.
create or replace function public.save_product_components_atomic(
  p_producto_id uuid,
  p_tienda_id   uuid,
  p_components  jsonb
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid     uuid := auth.uid();
  v_product record;
  v_item    jsonb;
  v_comp_id uuid;
  v_qty     numeric;
  v_comp    record;
  v_count   integer := 0;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  if not exists (
    select 1 from public.user_tiendas
    where user_id = v_uid and tienda_id = p_tienda_id and rol = 'admin' and is_active = true
  ) then
    raise exception 'Solo el admin puede editar la receta de un producto';
  end if;

  if p_components is null or jsonb_typeof(p_components) <> 'array' then
    raise exception 'Componentes inválidos';
  end if;

  select id, nombre, tipo into v_product
  from public.productos
  where id = p_producto_id and tienda_id = p_tienda_id and deleted_at is null
  for update;

  if v_product.id is null then
    raise exception 'Producto no encontrado';
  end if;

  if v_product.tipo not in ('prepared', 'combo') then
    raise exception 'Solo los preparados y combos tienen componentes';
  end if;

  -- Validar todo antes de escribir.
  for v_item in select * from jsonb_array_elements(p_components) loop
    v_comp_id := nullif(v_item ->> 'componente_id', '')::uuid;
    v_qty     := (v_item ->> 'cantidad')::numeric;

    if v_comp_id is null or v_qty is null or v_qty <= 0 then
      raise exception 'Cada componente necesita producto y cantidad mayor a 0';
    end if;

    if v_comp_id = p_producto_id then
      raise exception 'Un producto no puede ser componente de sí mismo';
    end if;

    select id, tipo into v_comp
    from public.productos
    where id = v_comp_id and tienda_id = p_tienda_id and deleted_at is null;

    if v_comp.id is null then
      raise exception 'Componente no encontrado';
    end if;

    -- Un componente sin stock propio generaría salidas sobre un producto sin inventario.
    if v_comp.tipo in ('prepared', 'combo') then
      raise exception 'Un preparado o combo no puede ser componente';
    end if;
  end loop;

  if (select count(distinct value ->> 'componente_id') from jsonb_array_elements(p_components))
     <> jsonb_array_length(p_components) then
    raise exception 'Hay componentes repetidos';
  end if;

  delete from public.product_components
  where producto_id = p_producto_id and tienda_id = p_tienda_id;

  insert into public.product_components (tienda_id, producto_id, componente_id, cantidad)
  select p_tienda_id, p_producto_id, (value ->> 'componente_id')::uuid, (value ->> 'cantidad')::numeric
  from jsonb_array_elements(p_components);

  get diagnostics v_count = row_count;

  insert into public.audit_logs (tienda_id, user_id, action, entity_type, entity_id, entity_label, changes)
  values (
    p_tienda_id, v_uid, 'product.components_saved', 'producto', p_producto_id, v_product.nombre,
    jsonb_build_object('components', p_components)
  );

  return v_count;
end;
$$;

revoke execute on function public.save_product_components_atomic(uuid, uuid, jsonb) from public, anon;
grant execute on function public.save_product_components_atomic(uuid, uuid, jsonb) to authenticated;

comment on function public.save_product_components_atomic(uuid, uuid, jsonb) is
  'Reemplaza en una transacción los componentes de un preparado/combo. Solo admin; valida tienda, tipo, cantidades y repetidos; audita.';

-- 2. Opciones de venta de un preparado (ADR 0017).
create or replace function public.save_product_options_atomic(
  p_producto_id uuid,
  p_tienda_id   uuid,
  p_options     jsonb
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid     uuid := auth.uid();
  v_product record;
  v_item    jsonb;
  v_comp_id uuid;
  v_comp    record;
  v_count   integer := 0;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  if not exists (
    select 1 from public.user_tiendas
    where user_id = v_uid and tienda_id = p_tienda_id and rol = 'admin' and is_active = true
  ) then
    raise exception 'Solo el admin puede editar las opciones de un producto';
  end if;

  if p_options is null or jsonb_typeof(p_options) <> 'array' then
    raise exception 'Opciones inválidas';
  end if;

  select id, nombre, tipo into v_product
  from public.productos
  where id = p_producto_id and tienda_id = p_tienda_id and deleted_at is null
  for update;

  if v_product.id is null then
    raise exception 'Producto no encontrado';
  end if;

  if v_product.tipo <> 'prepared' then
    raise exception 'Solo los preparados tienen opciones de venta';
  end if;

  for v_item in select * from jsonb_array_elements(p_options) loop
    if btrim(coalesce(v_item ->> 'grupo', '')) = '' or btrim(coalesce(v_item ->> 'nombre', '')) = '' then
      raise exception 'Cada opción necesita grupo y nombre';
    end if;

    if coalesce((v_item ->> 'precio_extra')::numeric, -1) < 0 then
      raise exception 'El recargo no puede ser negativo';
    end if;

    v_comp_id := nullif(v_item ->> 'componente_id', '')::uuid;
    if v_comp_id is not null then
      if coalesce((v_item ->> 'componente_cantidad')::numeric, 0) <= 0 then
        raise exception 'Indica cuánto consume la opción "%"', v_item ->> 'nombre';
      end if;

      select id, tipo into v_comp
      from public.productos
      where id = v_comp_id and tienda_id = p_tienda_id and deleted_at is null;

      if v_comp.id is null then
        raise exception 'Componente de la opción no encontrado';
      end if;

      if v_comp.tipo in ('prepared', 'combo') then
        raise exception 'Una opción no puede consumir un preparado o combo';
      end if;
    end if;
  end loop;

  if (select count(distinct (btrim(value ->> 'grupo'), btrim(value ->> 'nombre'))) from jsonb_array_elements(p_options))
     <> jsonb_array_length(p_options) then
    raise exception 'Hay opciones con el mismo nombre';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_options)
    where coalesce((value ->> 'es_default')::boolean, false)
    group by btrim(value ->> 'grupo')
    having count(*) > 1
  ) then
    raise exception 'Solo una opción puede ser la predeterminada';
  end if;

  -- Liberar los defaults primero: el índice único parcial
  -- ux_product_options_default se valida fila a fila.
  update public.product_options
  set es_default = false
  where producto_id = p_producto_id and tienda_id = p_tienda_id and es_default;

  -- Upsert por la clave natural: las ventas pasadas referencian option_id,
  -- así que las filas existentes se actualizan, nunca se recrean.
  insert into public.product_options (
    tienda_id, producto_id, grupo, nombre, precio_extra,
    componente_id, componente_cantidad, es_default, orden, is_active
  )
  select
    p_tienda_id,
    p_producto_id,
    btrim(o.value ->> 'grupo'),
    btrim(o.value ->> 'nombre'),
    (o.value ->> 'precio_extra')::numeric,
    nullif(o.value ->> 'componente_id', '')::uuid,
    case when nullif(o.value ->> 'componente_id', '') is null then 0
         else (o.value ->> 'componente_cantidad')::numeric end,
    coalesce((o.value ->> 'es_default')::boolean, false),
    (o.ordinality - 1)::int,
    true
  from jsonb_array_elements(p_options) with ordinality as o(value, ordinality)
  on conflict (producto_id, grupo, nombre) do update
  set precio_extra        = excluded.precio_extra,
      componente_id       = excluded.componente_id,
      componente_cantidad = excluded.componente_cantidad,
      es_default          = excluded.es_default,
      orden               = excluded.orden,
      is_active           = true;

  get diagnostics v_count = row_count;

  -- Las que el admin quitó se DESACTIVAN, nunca se borran (ADR 0017 §2.2).
  update public.product_options po
  set is_active = false, es_default = false
  where po.producto_id = p_producto_id
    and po.tienda_id = p_tienda_id
    and po.is_active
    and not exists (
      select 1 from jsonb_array_elements(p_options) o
      where btrim(o.value ->> 'grupo') = po.grupo and btrim(o.value ->> 'nombre') = po.nombre
    );

  insert into public.audit_logs (tienda_id, user_id, action, entity_type, entity_id, entity_label, changes)
  values (
    p_tienda_id, v_uid, 'product.options_saved', 'producto', p_producto_id, v_product.nombre,
    jsonb_build_object('options', p_options)
  );

  return v_count;
end;
$$;

revoke execute on function public.save_product_options_atomic(uuid, uuid, jsonb) from public, anon;
grant execute on function public.save_product_options_atomic(uuid, uuid, jsonb) to authenticated;

comment on function public.save_product_options_atomic(uuid, uuid, jsonb) is
  'Reemplaza en una transacción las opciones de venta de un preparado: upsert por (producto, grupo, nombre), desactiva las quitadas, sin chocar con el default único. Solo admin; audita.';
