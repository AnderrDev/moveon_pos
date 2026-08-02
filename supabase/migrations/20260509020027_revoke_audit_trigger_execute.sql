-- =====================================================
-- Revoke EXECUTE en funciones de trigger — auditoría 2026-05-08
-- =====================================================
-- Las trigger functions de la migración 20260508_004 quedaron
-- expuestas vía /rest/v1/rpc/tg_* porque Postgres concede EXECUTE
-- a public por defecto. No deben ser invocables manualmente — los
-- triggers se disparan con privilegios del owner de la tabla
-- independiente del grant.
-- =====================================================

revoke execute on function public.tg_audit_producto_price()        from public, anon, authenticated;
revoke execute on function public.tg_audit_inventory_adjustment()  from public, anon, authenticated;
