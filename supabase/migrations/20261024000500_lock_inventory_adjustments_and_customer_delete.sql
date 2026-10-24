-- =====================================================
-- Bloquear ajustes de stock directos y borrado físico de clientes (paso 2 de 2)
-- =====================================================
-- Requiere 20261024000400 y el frontend que ya usa adjust_stock_atomic y
-- delete_customer_atomic.
--
--   * inventory_movements: sin escritura directa. Entradas, ajustes,
--     traslados, ventas, anulaciones y stock inicial pasan por RPC
--     SECURITY DEFINER. Se elimina la policy de INSERT para admin.
--   * clientes: sin DELETE. INSERT/UPDATE directos se conservan (alta y
--     edición del formulario) pero limitados a las columnas del formulario:
--     el cliente no puede marcar ni revertir deleted_at / deleted_by.

drop policy if exists inventory_movements_admin_insert on public.inventory_movements;

revoke insert, update, delete, truncate on public.inventory_movements from authenticated, anon;

revoke delete, truncate on public.clientes from authenticated, anon;

revoke insert, update on public.clientes from authenticated, anon;

grant insert (
  tienda_id, tipo_documento, numero_documento, nombre, email, telefono,
  celular_normalizado, autoriza_fidelizacion, acepta_mensajes_promocionales
) on public.clientes to authenticated;

grant update (
  tipo_documento, numero_documento, nombre, email, telefono,
  celular_normalizado, autoriza_fidelizacion, acepta_mensajes_promocionales
) on public.clientes to authenticated;
