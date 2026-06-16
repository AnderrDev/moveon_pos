# Spec de Sesión — 2026-06-16 — Mejoras productos, auditoría y login

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-06-16 |
| Sprint | Sprint 4 |
| Agente | Claude Code |
| HUs trabajadas | — |
| Estado | Completada |

---

## 1. Objetivo de la sesión

Mejorar la vista de productos con filtros y columnas de costo/tipo/stock, borrado lógico, sistema de auditoría completo y limpieza del login.

---

## 2. Lo que se implementó

### 2.1 Archivos creados
- `supabase/migrations/20260615_001_productos_soft_delete.sql`
- `supabase/migrations/20260615_002_audit_logs.sql`
- `src/modules/audit/domain/entities/audit-log.entity.ts`
- `apps/.../audit/audit-log.repository.ts`
- `apps/.../audit/auditoria.page.ts`

### 2.2 Archivos modificados
- `productos.page.ts` — filtros categoría/estado, columnas tipo/costo/stock, borrado lógico
- `inventario.page.ts` — columnas tipo, costo, precio
- `products.repository.ts` — soft delete, filtro deleted_at, audit logs
- `inventory.repository.ts` / `cash-register.repository.ts` / `pos-sale.service.ts` / `sales.repository.ts` — audit logs
- `login.page.ts` — credenciales prefilled cambiadas de admin a cajero

---

## 5. Tests

- [x] `pnpm typecheck` — pasó
- [x] `pnpm test` — 340 tests pasaron

---

## 7. Próximos pasos

1. Aplicar migrations en Supabase: 20260615_001 y 20260615_002
2. Quitar patchValue del login antes de producción
