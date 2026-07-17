-- ============================================================
-- MIGRACIÓN — Paridad de grants de tablas con el remoto (PLAN-46)
--
-- En el proyecto remoto los roles anon/authenticated/service_role tienen los
-- grants DML estándar de Supabase sobre public (la seguridad real la aplica
-- RLS). En una base local creada desde cero por las migraciones esos grants
-- no existían, así que PostgREST devolvía "permission denied" en tablas como
-- user_tiendas o sales. Esta migración deja ambos entornos igual:
--   1. grants estándar sobre todo public (idempotente; en remoto no cambia nada),
--   2. re-aplica los revokes puntuales de hardening que sí son deliberados.
-- ============================================================

grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on all tables in schema public
  to anon, authenticated, service_role;

grant usage, select on all sequences in schema public
  to anon, authenticated, service_role;

-- Tablas de migraciones futuras (aplican al rol que ejecuta migraciones).
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated, service_role;

-- Re-aplicar hardening deliberado (20260710000200): el catálogo público no
-- expone productos crudos a anon — solo la vista storefront_productos_publicos.
revoke select on public.productos from public;
revoke select on public.productos from anon;
grant select on public.productos to authenticated;
revoke all on public.storefront_productos_publicos from public;
grant select on public.storefront_productos_publicos to anon, authenticated;
