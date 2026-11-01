-- =====================================================
-- PLAN-112 revertido (2026-11-01): quitar familia y sabor de productos
-- =====================================================
-- El dueño pidió dejar la lista de compras y el producto como antes. El
-- frontend ya no lee ni escribe estas columnas; se eliminan para no dejar
-- esquema huérfano. Los valores que tenían (propuesta automática de familias)
-- están en outputs/2026-11-01-propuesta-familias.sql por si se retoma.
-- =====================================================

drop index if exists public.ix_productos_tienda_familia;

alter table public.productos
  drop constraint if exists productos_familia_len,
  drop constraint if exists productos_sabor_len,
  drop column if exists familia,
  drop column if exists sabor;
