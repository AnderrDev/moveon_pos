# Spec de Sesión — 2026-05-09 — Verificación Supabase post-hardening

> Sesión de verificación end-to-end del estado de Supabase tras los cinco
> migraciones aplicadas el 2026-05-08. Hallazgo extra: `update_updated_at`
> conservaba EXECUTE de `public` por el `CREATE OR REPLACE` de la migración
> 001; aplicada migración 006 para limpiarlo.

---

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-05-09 |
| Sprint | Sprint 4 (post-perf) |
| Agente | Claude Code (Opus 4.7) |
| HUs trabajadas | N/A — Verificación + cleanup |
| Estado | Completada |

---

## 1. Objetivo de la sesión

Verificar con el MCP de Supabase que todas las migraciones del 2026-05-08
quedaron bien aplicadas: advisors, lista de migraciones, RLS por tabla,
search_path, security mode, grants, policies, triggers, e índices.

---

## 2. Lo que se implementó

### 2.1 Archivos creados
- `supabase/migrations/20260509_001_revoke_update_updated_at.sql` — Revoke EXECUTE de `public`/`anon`/`authenticated` en la trigger function.
- `docs/sessions/2026-05-09-verificacion-supabase.md` — este spec.

### 2.2 Archivos modificados
Ninguno.

### 2.3 Archivos eliminados
Ninguno.

---

## 3. Decisiones tomadas

| Decisión | Razón |
|---|---|
| Revocar `update_updated_at` aunque no es DEFINER | El advisor no la marca, pero está expuesta como `/rest/v1/rpc/update_updated_at`. Limpieza de superficie aunque el riesgo sea bajo |
| Mantener 4 FKs sin índice (`audit_logs.user_id`, `cash_sessions.closed_by`, `sales.billing_document_id`, `sales.voided_by`) | Son cold paths; revisar a 30 días de tráfico real con `unused_index` |
| Mantener 3 funciones SECURITY DEFINER expuestas a `authenticated` | `get_user_tiendas`, `void_sale_atomic`, `close_cash_session_atomic` validan `auth.uid()` internamente. Cambiar a INVOKER rompería el modelo (ej. el bypass de RLS para escribir `audit_logs` desde `void_sale_atomic`) |

---

## 4. ADRs creados o actualizados

Ninguno.

---

## 5. Tests

Verificación con MCP en lugar de tests locales (ya pasaron 2026-05-08: `typecheck`/`lint`/`test` verde con 117/117).

| Categoría | Estado |
|---|---|
| `function_search_path_mutable` | 0 ✅ |
| `anon_security_definer_function_executable` | 0 ✅ |
| `auth_rls_initplan` | 0 ✅ |
| `unindexed_foreign_keys` | 4 (frías intencionales) ⚠️ |
| `authenticated_security_definer_function_executable` | 3 (intencionales) ⚠️ |
| `auth_leaked_password_protection` | 1 (config Auth Dashboard) ⚠️ |

### Migrations aplicadas en remote (`list_migrations`)

```
20260426034839 initial_schema
20260426034930 products_inventory_customers
20260426034952 cash_sales_billing_settings
20260426035001 rls_policies
20260509013658 20260508_001_security_hardening
20260509013711 20260508_002_perf_fk_indexes
20260509013750 20260508_003_close_cash_session_atomic
20260509020001 20260508_004_audit_triggers
20260509020027 20260508_005_revoke_audit_trigger_execute
20260509???    20260509_001_revoke_update_updated_at
```

### Funciones públicas — security & search_path

| fn | security | search_path |
|---|---|---|
| `close_cash_session_atomic` | DEFINER | `public, pg_temp` ✅ |
| `create_sale_atomic` | INVOKER | `public` ✅ |
| `get_stock` | INVOKER | `public, pg_temp` ✅ |
| `get_user_tiendas` | DEFINER | `public, pg_temp` ✅ |
| `tg_audit_inventory_adjustment` | DEFINER | `public, pg_temp` ✅ |
| `tg_audit_producto_price` | DEFINER | `public, pg_temp` ✅ |
| `update_updated_at` | INVOKER | `public, pg_temp` ✅ |
| `void_sale_atomic` | DEFINER | `public` ✅ |

### Grants EXECUTE finales (rol → función)

| fn | rol con EXECUTE |
|---|---|
| `close_cash_session_atomic` | authenticated |
| `create_sale_atomic` | authenticated |
| `get_stock` | authenticated |
| `get_user_tiendas` | authenticated |
| `void_sale_atomic` | authenticated |
| `update_updated_at` | (ninguno público) ✅ |
| `tg_audit_inventory_adjustment` | (ninguno público) ✅ |
| `tg_audit_producto_price` | (ninguno público) ✅ |

**0 funciones ejecutables por `anon` o `public`.**

### RLS Policies — todas en `{authenticated}`

- `audit_logs.tenant_select` (SELECT)
- `tiendas.tenant_select` (SELECT)
- `user_tiendas.own_rows_select` (SELECT)
- `tenant_isolation` (ALL) en: `billing_documents`, `billing_events`, `cash_movements`, `cash_sessions`, `categorias`, `clientes`, `inventory_movements`, `payments`, `productos`, `sale_items`, `sales`, `settings`.

15 policies, 0 con rol `{public}`.

### Tablas con RLS activado

15 tablas, todas con `rls_enabled: true`.

### Triggers en `public`

- `billing_documents_updated_at` BEFORE UPDATE
- `categorias_updated_at` BEFORE UPDATE
- `clientes_updated_at` BEFORE UPDATE
- `inventory_movements::tr_audit_inventory_adjustment` AFTER INSERT ✅ nuevo
- `productos_updated_at` BEFORE UPDATE
- `productos::tr_audit_productos_price` AFTER UPDATE ✅ nuevo
- `sales_updated_at` BEFORE UPDATE
- `settings_updated_at` BEFORE UPDATE
- `tiendas_updated_at` BEFORE UPDATE

### Índices nuevos verificados

- `cash_movements::ix_cash_movements_created_by`
- `inventory_movements::ix_inv_mov_created_by`
- `inventory_movements::ix_inv_mov_producto_only`
- `productos::ix_productos_categoria` (parcial, `where categoria_id is not null`)
- `sales::ix_sales_cashier`
- `user_tiendas::ix_user_tiendas_tienda`

---

## 6. Bloqueos y preguntas pendientes

- **Activar leaked-password protection** en Supabase Dashboard → Auth → Password security. No tiene API SQL ni MCP tool. Acción manual del dueño.
- **ADR de hosting frontend** (Cloudflare Pages vs alternativas).
- **ADR de denormalización `tienda_id`** en `payments`/`sale_items`/`cash_movements`/`billing_events`.

---

## 7. Próximos pasos

1. Aplicar `leaked-password protection` en Auth Dashboard.
2. Dejar la DB en producción 30 días y volver a correr `get_advisors performance` para revisar `unused_index` (varios actuales son ruido por DB demo).
3. Suite Vitest de integración para `void_sale_atomic` y `close_cash_session_atomic`.
4. Setup `@analogjs/vitest-angular` para tests de presenters Angular.
5. Migrar el resto de presenters (cash-register, products) a `Result<T, E>` + Zod.
6. Implementar M4 (descuentos con permiso por rol) y M9 (importador CSV Siigo) — features pendientes del MVP.

---

## 8. Notas adicionales

### Por qué quedó EXECUTE público en `update_updated_at`

`CREATE OR REPLACE FUNCTION` no resetea grants — sólo cambia el cuerpo. La migración inicial (`20240101000000_initial_schema.sql`) creó la función sin REVOKE explícito, así que Postgres mantuvo el grant default a `public`. La migración 001 del 2026-05-08 sólo revocó las funciones que el linter marcaba (DEFINER expuestas). Esta sesión cerró el último grant pendiente.

### Estado del proyecto

Supabase está limpio para go-live de MVP excepto por la config de Auth Dashboard (leaked-password). El MCP de Supabase no expone API para esa configuración; el usuario debe activarla manualmente.
