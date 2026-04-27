-- ============================================================
-- MIGRACIÓN 2 — MOVEONAPP POS
-- Módulos: productos (categorias, productos),
--          inventario (inventory_movements, get_stock),
--          clientes
-- ============================================================

-- ==================== CATEGORIAS ====================

create table categorias (
  id          uuid        primary key default gen_random_uuid(),
  tienda_id   uuid        not null references tiendas(id) on delete cascade,
  nombre      text        not null,
  orden       int         not null default 0,
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tienda_id, nombre)
);

create trigger categorias_updated_at before update on categorias
  for each row execute function update_updated_at();

-- ==================== PRODUCTOS ====================

create table productos (
  id              uuid         primary key default gen_random_uuid(),
  tienda_id       uuid         not null references tiendas(id) on delete cascade,
  categoria_id    uuid         references categorias(id) on delete set null,
  nombre          text         not null,
  sku             text,
  codigo_barras   text,
  tipo            product_type not null default 'simple',
  unidad          text         not null default 'unidad',
  precio_venta    numeric(14,2) not null,
  costo           numeric(14,2),
  iva_tasa        numeric(5,2)  not null default 0,
  stock_minimo    numeric(14,3) not null default 0,
  is_active       boolean      not null default true,
  created_at      timestamptz  not null default now(),
  updated_at      timestamptz  not null default now()
);

create unique index ux_productos_tienda_sku      on productos (tienda_id, sku)           where sku is not null;
create unique index ux_productos_tienda_barcode  on productos (tienda_id, codigo_barras) where codigo_barras is not null;
create index        ix_productos_tienda_nombre   on productos (tienda_id, nombre);

create trigger productos_updated_at before update on productos
  for each row execute function update_updated_at();

-- ==================== INVENTORY_MOVEMENTS ====================

create table inventory_movements (
  id              uuid                     primary key default gen_random_uuid(),
  tienda_id       uuid                     not null references tiendas(id) on delete cascade,
  producto_id     uuid                     not null references productos(id) on delete restrict,
  tipo            inventory_movement_type  not null,
  cantidad        numeric(14,3)            not null,
  costo_unitario  numeric(14,2),
  motivo          text,
  referencia_tipo text,
  referencia_id   uuid,
  created_by      uuid                     not null references auth.users(id),
  created_at      timestamptz              not null default now()
);

create index ix_inv_mov_producto   on inventory_movements (tienda_id, producto_id, created_at desc);
create index ix_inv_mov_referencia on inventory_movements (referencia_tipo, referencia_id);

-- Calcula el stock actual de un producto en una tienda
create or replace function get_stock(p_producto_id uuid, p_tienda_id uuid)
returns numeric language sql stable as $$
  select coalesce(sum(cantidad), 0)
  from inventory_movements
  where producto_id = p_producto_id
    and tienda_id   = p_tienda_id;
$$;

-- ==================== CLIENTES ====================

create table clientes (
  id                  uuid        primary key default gen_random_uuid(),
  tienda_id           uuid        not null references tiendas(id) on delete cascade,
  tipo_documento      text,
  numero_documento    text,
  nombre              text        not null,
  email               text,
  telefono            text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create unique index ux_clientes_documento
  on clientes (tienda_id, tipo_documento, numero_documento)
  where numero_documento is not null;
create index ix_clientes_nombre   on clientes (tienda_id, nombre);
create index ix_clientes_telefono on clientes (tienda_id, telefono);

create trigger clientes_updated_at before update on clientes
  for each row execute function update_updated_at();
