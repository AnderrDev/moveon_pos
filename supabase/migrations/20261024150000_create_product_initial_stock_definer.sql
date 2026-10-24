-- =====================================================
-- create_product_with_initial_stock vuelve a poder registrar el stock inicial
-- =====================================================
-- 20261024000500 quitó a `authenticated` el INSERT directo sobre
-- inventory_movements asumiendo que el stock inicial pasaba por una RPC
-- SECURITY DEFINER, pero esta función era SECURITY INVOKER: crear un producto
-- con stock inicial > 0 fallaba con "permission denied for table
-- inventory_movements" (en el POS web y en la app iOS). Se detectó con el
-- contrato de payloads de la app iOS (PLAN-89).
--
-- Pasarla a DEFINER es seguro: la función ya exige sesión, rol admin activo en
-- la tienda, categoría y proveedor de la misma tienda y stock no negativo, y
-- fija search_path. EXECUTE sigue solo para `authenticated`.

alter function public.create_product_with_initial_stock(
  uuid, text, text, text, uuid, text, text, public.product_type, text, numeric, numeric, numeric,
  numeric, boolean, numeric, public.inventory_location, uuid, text, boolean
) security definer;

revoke execute on function public.create_product_with_initial_stock(
  uuid, text, text, text, uuid, text, text, public.product_type, text, numeric, numeric, numeric,
  numeric, boolean, numeric, public.inventory_location, uuid, text, boolean
) from public, anon;
