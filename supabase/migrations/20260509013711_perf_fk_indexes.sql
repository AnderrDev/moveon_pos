-- =====================================================
-- Indices para FKs hot path — auditoría 2026-05-08 (P2)
-- =====================================================
-- Cubre los foreign keys que el Database Linter marcó sin índice
-- y que están en el camino de queries reales:
--   - inventory_movements.producto_id  (kardex por producto)
--   - sales.cashier_id                 (reportes por cajero)
--   - productos.categoria_id           (filtro por categoria)
--   - user_tiendas.tienda_id           (lookup inverso)
--   - cash_movements.created_by        (auditoría por usuario)
--   - inventory_movements.created_by   (auditoría por usuario)
--
-- Las FKs frías (sales.voided_by, sales.billing_document_id,
-- cash_sessions.closed_by, audit_logs.user_id) se omiten a propósito:
-- son selects esporádicos sobre pocos registros; volver a evaluarlos
-- con get_advisors a los 30 días de uso real.
-- =====================================================

create index if not exists ix_inv_mov_producto_only
  on public.inventory_movements (producto_id);

create index if not exists ix_inv_mov_created_by
  on public.inventory_movements (created_by);

create index if not exists ix_sales_cashier
  on public.sales (cashier_id);

create index if not exists ix_productos_categoria
  on public.productos (categoria_id)
  where categoria_id is not null;

create index if not exists ix_user_tiendas_tienda
  on public.user_tiendas (tienda_id);

create index if not exists ix_cash_movements_created_by
  on public.cash_movements (created_by);
