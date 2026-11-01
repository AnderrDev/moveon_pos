-- =====================================================
-- PLAN-113 (2026-11-01): fraccionar un producto en porciones (sachets)
-- =====================================================
-- La tienda abre un tarro (PASE 30 SERV) para armar sachets (PASE SACHET) y
-- venderlos. No es una compra (no sale plata) ni un ajuste a secas (dejaría
-- el sachet sin costo). `split_product_atomic` registra en una transacción:
--   * salida del origen: adjustment, cantidad −N, referencia_tipo 'product_split';
--   * entrada del destino: adjustment, cantidad +M, costo_unitario =
--     costo del origen × N ÷ M, referencia_tipo 'product_split', enlazada;
--   * el costo vigente del destino pasa a ese costo unitario (misma regla que
--     una entrada: el último costo manda), para que la venta del sachet
--     descuente su costo real en la ganancia y en el sobre de mercancía.
-- Ninguno es tipo 'entry': el fondo/sobres no lo cuentan como compra.
-- El trigger tg_audit_inventory_adjustment audita ambos movimientos.
-- =====================================================

create or replace function public.split_product_atomic(
  p_tienda_id        uuid,
  p_origen_id        uuid,
  p_cantidad_origen  numeric,
  p_destino_id       uuid,
  p_cantidad_destino numeric,
  p_ubicacion        public.inventory_location,
  p_motivo           text,
  p_created_by       uuid
)
returns public.inventory_movements
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid        uuid := auth.uid();
  v_origen     record;
  v_destino    record;
  v_stock      numeric;
  v_costo_u    numeric;
  v_motivo     text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_out        public.inventory_movements;
  v_in         public.inventory_movements;
begin
  if v_uid is null or v_uid <> p_created_by then
    raise exception 'No autenticado';
  end if;

  if not exists (
    select 1 from public.user_tiendas
    where user_id = v_uid and tienda_id = p_tienda_id and rol = 'admin' and is_active = true
  ) then
    raise exception 'Solo el admin puede fraccionar productos';
  end if;

  if p_origen_id = p_destino_id then
    raise exception 'El producto que abres y el que sale deben ser distintos';
  end if;

  if p_cantidad_origen is null or p_cantidad_origen <= 0 then
    raise exception 'Indica cuántas unidades abres (mayor a 0)';
  end if;

  if p_cantidad_destino is null or p_cantidad_destino <= 0 or p_cantidad_destino <> round(p_cantidad_destino) then
    raise exception 'Indica cuántas porciones salen (entero mayor a 0)';
  end if;

  if v_motivo is not null and length(v_motivo) > 200 then
    raise exception 'La nota no puede pasar de 200 caracteres';
  end if;

  -- Bloquea ambos productos (orden fijo por id para evitar interbloqueos).
  for v_origen in
    select id, nombre, tipo, costo from public.productos
    where id in (p_origen_id, p_destino_id) and tienda_id = p_tienda_id and deleted_at is null
    order by id
    for update
  loop
    null;
  end loop;

  select id, nombre, tipo, costo into v_origen
  from public.productos where id = p_origen_id and tienda_id = p_tienda_id and deleted_at is null;
  select id, nombre, tipo, costo into v_destino
  from public.productos where id = p_destino_id and tienda_id = p_tienda_id and deleted_at is null;

  if v_origen.id is null or v_destino.id is null then
    raise exception 'Producto no encontrado';
  end if;

  if v_origen.tipo in ('prepared', 'combo') or v_destino.tipo in ('prepared', 'combo') then
    raise exception 'Este tipo de producto no maneja inventario propio';
  end if;

  if v_origen.costo is null or v_origen.costo <= 0 then
    raise exception 'ORIGEN_SIN_COSTO';
  end if;

  select coalesce(sum(cantidad), 0) into v_stock
  from public.inventory_movements
  where tienda_id = p_tienda_id and producto_id = p_origen_id and ubicacion = p_ubicacion;

  if v_stock < p_cantidad_origen then
    raise exception 'STOCK_INSUFICIENTE';
  end if;

  v_costo_u := round(v_origen.costo * p_cantidad_origen / p_cantidad_destino, 2);

  insert into public.inventory_movements (
    tienda_id, producto_id, tipo, ubicacion, cantidad, motivo, referencia_tipo, created_by
  ) values (
    p_tienda_id, p_origen_id, 'adjustment', p_ubicacion, -p_cantidad_origen,
    'Fraccionado en ' || trim(to_char(p_cantidad_destino, 'FM999999990')) || ' × ' || v_destino.nombre
      || coalesce(' · ' || v_motivo, ''),
    'product_split', v_uid
  )
  returning * into v_out;

  insert into public.inventory_movements (
    tienda_id, producto_id, tipo, ubicacion, cantidad, costo_unitario, motivo, referencia_tipo, referencia_id, created_by
  ) values (
    p_tienda_id, p_destino_id, 'adjustment', p_ubicacion, p_cantidad_destino, v_costo_u,
    'Viene de ' || trim(to_char(p_cantidad_origen, 'FM999999990.##')) || ' × ' || v_origen.nombre
      || coalesce(' · ' || v_motivo, ''),
    'product_split', v_out.id, v_uid
  )
  returning * into v_in;

  update public.inventory_movements set referencia_id = v_in.id where id = v_out.id;

  update public.productos set costo = v_costo_u where id = p_destino_id and tienda_id = p_tienda_id;

  return v_in;
end;
$$;

revoke all on function public.split_product_atomic(
  uuid, uuid, numeric, uuid, numeric, public.inventory_location, text, uuid
) from public, anon;
grant execute on function public.split_product_atomic(
  uuid, uuid, numeric, uuid, numeric, public.inventory_location, text, uuid
) to authenticated;

comment on function public.split_product_atomic(
  uuid, uuid, numeric, uuid, numeric, public.inventory_location, text, uuid
) is
  'Fraccionar (PLAN-113): sale N del origen y entran M del destino con costo = costo origen × N ÷ M; '
  'ambos movimientos son adjustment con referencia_tipo product_split (no cuentan como compra). Solo admin.';
