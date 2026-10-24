-- =====================================================
-- Sin escritura directa de recetas ni opciones de producto (paso 2 de 2)
-- =====================================================
-- Requiere 20261024000600 y el frontend que ya usa
-- save_product_components_atomic / save_product_options_atomic.
-- La lectura sigue igual (pc_read / po_read).

drop policy if exists pc_admin_insert on public.product_components;
drop policy if exists pc_admin_update on public.product_components;
drop policy if exists pc_admin_delete on public.product_components;

drop policy if exists po_admin_insert on public.product_options;
drop policy if exists po_admin_update on public.product_options;
drop policy if exists po_admin_delete on public.product_options;

revoke insert, update, delete, truncate on public.product_components, public.product_options
from authenticated, anon;
