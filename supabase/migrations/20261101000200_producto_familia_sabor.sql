-- =====================================================
-- PLAN-112 (2026-11-01): familia y sabor del producto
-- =====================================================
-- Los sabores de un mismo producto (WHEY GOLD STANDARD VAINILLA 2LB,
-- WHEY GOLD STANDARD CHOCOLATE 2LB…) son productos distintos con su propio
-- stock, costo y ventas, pero al proveedor se le piden juntos. `familia` es
-- el producto base con su presentación (WHEY GOLD STANDARD 2LB) y `sabor` la
-- variante. Solo lectura/agrupación: no cambia stock, ventas ni costos.
-- Sin RLS nuevo: son columnas de `productos`.
-- =====================================================

alter table public.productos
  add column if not exists familia text,
  add column if not exists sabor   text;

alter table public.productos
  drop constraint if exists productos_familia_len,
  add constraint productos_familia_len check (familia is null or (length(btrim(familia)) between 2 and 100)),
  drop constraint if exists productos_sabor_len,
  add constraint productos_sabor_len check (sabor is null or (length(btrim(sabor)) between 1 and 60));

create index if not exists ix_productos_tienda_familia
  on public.productos (tienda_id, familia)
  where familia is not null;

comment on column public.productos.familia is
  'Producto base con su presentación (ej. WHEY GOLD STANDARD 2LB). Agrupa sabores en la lista de compras (PLAN-112).';
comment on column public.productos.sabor is
  'Variante dentro de la familia (ej. Vainilla). Opcional.';
