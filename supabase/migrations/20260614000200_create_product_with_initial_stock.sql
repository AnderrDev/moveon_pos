create or replace function public.create_product_with_initial_stock(
  p_tienda_id uuid,
  p_nombre text,
  p_sku text,
  p_codigo_barras text,
  p_categoria_id uuid,
  p_para_que_sirve text,
  p_recomendado_para text,
  p_tipo public.product_type,
  p_unidad text,
  p_precio_venta numeric,
  p_costo numeric,
  p_iva_tasa numeric,
  p_stock_minimo numeric,
  p_is_active boolean,
  p_initial_stock numeric,
  p_initial_location public.inventory_location
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_product_id uuid;
begin
  if v_user_id is null then
    raise exception 'No autenticado';
  end if;

  if not exists (
    select 1
    from public.user_tiendas
    where user_id = v_user_id
      and tienda_id = p_tienda_id
      and rol = 'admin'
      and is_active = true
  ) then
    raise exception 'Solo un administrador puede crear productos con inventario inicial';
  end if;

  if coalesce(p_initial_stock, 0) < 0 then
    raise exception 'El inventario inicial no puede ser negativo';
  end if;

  if p_tipo = 'prepared' and coalesce(p_initial_stock, 0) > 0 then
    raise exception 'Los productos preparados no controlan inventario inicial';
  end if;

  if p_categoria_id is not null and not exists (
    select 1
    from public.categorias
    where id = p_categoria_id
      and tienda_id = p_tienda_id
      and is_active = true
  ) then
    raise exception 'La categoría no pertenece a la tienda';
  end if;

  insert into public.productos (
    tienda_id, nombre, sku, codigo_barras, categoria_id,
    para_que_sirve, recomendado_para, tipo, unidad,
    precio_venta, costo, iva_tasa, stock_minimo, is_active
  ) values (
    p_tienda_id, btrim(p_nombre), nullif(btrim(p_sku), ''),
    nullif(btrim(p_codigo_barras), ''), p_categoria_id,
    nullif(btrim(p_para_que_sirve), ''), nullif(btrim(p_recomendado_para), ''),
    p_tipo, btrim(p_unidad), p_precio_venta, p_costo,
    p_iva_tasa, p_stock_minimo, p_is_active
  )
  returning id into v_product_id;

  if coalesce(p_initial_stock, 0) > 0 then
    insert into public.inventory_movements (
      tienda_id, producto_id, tipo, ubicacion, cantidad,
      costo_unitario, motivo, referencia_tipo, referencia_id, created_by
    ) values (
      p_tienda_id, v_product_id, 'entry', p_initial_location, p_initial_stock,
      p_costo, 'Inventario inicial al crear producto',
      'product_initial_stock', v_product_id, v_user_id
    );
  end if;

  return v_product_id;
end;
$$;

revoke execute on function public.create_product_with_initial_stock(
  uuid, text, text, text, uuid, text, text, public.product_type,
  text, numeric, numeric, numeric, numeric, boolean, numeric,
  public.inventory_location
) from public, anon;

grant execute on function public.create_product_with_initial_stock(
  uuid, text, text, text, uuid, text, text, public.product_type,
  text, numeric, numeric, numeric, numeric, boolean, numeric,
  public.inventory_location
) to authenticated;

comment on function public.create_product_with_initial_stock(
  uuid, text, text, text, uuid, text, text, public.product_type,
  text, numeric, numeric, numeric, numeric, boolean, numeric,
  public.inventory_location
) is
  'Crea un producto y, opcionalmente, su movimiento entry de inventario inicial en una sola transacción.';
