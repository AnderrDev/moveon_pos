-- =====================================================
-- Revoke EXECUTE en update_updated_at — verificación 2026-05-09
-- =====================================================
-- update_updated_at es una trigger function.
-- Postgres dejó EXECUTE a public por defecto cuando se recreó en
-- 20260508_001 (CREATE OR REPLACE no resetea grants), por lo que el rol
-- anon podía invocarla vía /rest/v1/rpc/update_updated_at. La función no
-- expone datos (retorna `trigger` sin contexto), pero el grant es ruido.
-- =====================================================
revoke execute on function public.update_updated_at() from public, anon, authenticated;
