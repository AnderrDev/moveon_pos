-- =====================================================
-- Indexes adicionales para performance de queries hot path
-- =====================================================
-- Plan: docs/sessions/2026-05-04-perf-plan-accion.md (Fase 3)
-- Contexto: queries que se disparan en cada navegacion / carga de feature
-- y aun no contaban con un indice optimo.
--
-- Cada indice es idempotente (`if not exists`) y no toca datos existentes,
-- por lo que es seguro re-aplicar sobre entornos ya migrados.
-- =====================================================

-- user_tiendas: query critica del SessionService.getAuthContext
-- (where user_id = ? and is_active = true)
create index if not exists ix_user_tiendas_user_active
  on user_tiendas (user_id, is_active);

-- categorias: query de listCategorias
-- (where tienda_id = ? order by orden, nombre)
create index if not exists ix_categorias_tienda_orden
  on categorias (tienda_id, orden, nombre);
