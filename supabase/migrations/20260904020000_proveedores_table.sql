-- ============================================================
-- Proveedores: normaliza productos.proveedor (texto libre) en tabla propia
-- ============================================================
-- RN-P08 decía deliberadamente "no hay tabla de proveedores en el MVP" y
-- 01-mvp-scope.md marcaba "Compras a proveedores" fuera de alcance. Se
-- revierte esa decisión puntual (no todo el módulo de compras): el texto
-- libre generaba proveedores duplicados/mal escritos en el filtro de
-- "faltantes por proveedor" de inventario. Alcance mínimo pedido por el
-- dueño: solo id + nombre, sin contacto ni condiciones de pago.

create table public.proveedores (
  id          uuid        primary key default gen_random_uuid(),
  tienda_id   uuid        not null references public.tiendas(id) on delete cascade,
  nombre      text        not null,
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index ux_proveedores_tienda_nombre on public.proveedores (tienda_id, lower(nombre));
create index ix_proveedores_tienda on public.proveedores (tienda_id) where is_active;

create trigger proveedores_updated_at before update on public.proveedores
  for each row execute function public.update_updated_at();

alter table public.proveedores enable row level security;

create policy "tenant_isolation" on public.proveedores
  for all to authenticated
  using (tienda_id in (select public.get_user_tiendas()));

comment on table public.proveedores is
  'Proveedores de productos, por tienda. Reemplaza el texto libre que tenía productos.proveedor (RN-P08). Alcance mínimo: solo nombre, sin contacto ni condiciones de pago.';

-- ==================== BACKFILL ====================
-- Un proveedor por cada valor de texto distinto (case-insensitive) ya usado
-- en productos, y luego se enlaza cada producto al proveedor resultante.

insert into public.proveedores (tienda_id, nombre)
select distinct tienda_id, btrim(proveedor)
from public.productos
where proveedor is not null and btrim(proveedor) <> ''
on conflict (tienda_id, lower(nombre)) do nothing;

alter table public.productos add column proveedor_id uuid references public.proveedores(id) on delete set null;

update public.productos p
set proveedor_id = pr.id
from public.proveedores pr
where pr.tienda_id = p.tienda_id
  and lower(pr.nombre) = lower(btrim(p.proveedor))
  and p.proveedor is not null
  and btrim(p.proveedor) <> '';

create index ix_productos_proveedor on public.productos (tienda_id, proveedor_id) where proveedor_id is not null;

alter table public.productos drop column proveedor;

-- ==================== RPC: create_product_with_initial_stock ====================
-- Redefine la firma (p_proveedor text -> p_proveedor_id uuid). Postgres trata
-- un cambio de tipo de parámetro como un overload distinto, así que primero
-- hay que tumbar la firma vieja (última definida en 20260803200100).

drop function if exists public.create_product_with_initial_stock(
  uuid, text, text, text, uuid, text, text, public.product_type,
  text, numeric, numeric, numeric, numeric, boolean, numeric,
  public.inventory_location, text, text, boolean
);

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
  p_initial_location public.inventory_location,
  p_proveedor_id uuid default null,
  p_image_url text default null,
  p_participa_fidelizacion boolean default false
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

  if p_tipo in ('prepared', 'combo') and coalesce(p_initial_stock, 0) > 0 then
    raise exception 'Los productos preparados y los combos no controlan inventario propio';
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

  if p_proveedor_id is not null and not exists (
    select 1
    from public.proveedores
    where id = p_proveedor_id
      and tienda_id = p_tienda_id
  ) then
    raise exception 'El proveedor no pertenece a la tienda';
  end if;

  insert into public.productos (
    tienda_id, nombre, sku, codigo_barras, categoria_id,
    para_que_sirve, recomendado_para, tipo, unidad,
    precio_venta, costo, iva_tasa, stock_minimo, is_active, proveedor_id, image_url,
    participa_fidelizacion
  ) values (
    p_tienda_id, btrim(p_nombre), nullif(btrim(p_sku), ''),
    nullif(btrim(p_codigo_barras), ''), p_categoria_id,
    nullif(btrim(p_para_que_sirve), ''), nullif(btrim(p_recomendado_para), ''),
    p_tipo, btrim(p_unidad), p_precio_venta, p_costo,
    p_iva_tasa, p_stock_minimo, p_is_active, p_proveedor_id,
    nullif(btrim(p_image_url), ''),
    coalesce(p_participa_fidelizacion, false)
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
  public.inventory_location, uuid, text, boolean
) from public, anon;

grant execute on function public.create_product_with_initial_stock(
  uuid, text, text, text, uuid, text, text, public.product_type,
  text, numeric, numeric, numeric, numeric, boolean, numeric,
  public.inventory_location, uuid, text, boolean
) to authenticated;
