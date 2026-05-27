# Spec de Sesión — 2026-05-08 — Auditoría arquitectura, infraestructura y testing + Fixes

> Sesión doble: primero auditoría integral (reporte en `2026-05-08-auditoria-hallazgos.md`),
> luego implementación de los hallazgos críticos y medios mecánicos.

---

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-05-08 |
| Sprint | Sprint 4 (post-perf) |
| Agente | Claude Code (Opus 4.7) |
| HUs trabajadas | N/A — Auditoría + hardening transversal |
| Estado | Completada |

---

## 1. Objetivo de la sesión

1. Auditar todo el proyecto: calidad, arquitectura, infraestructura Supabase y testing.
2. Aplicar los hallazgos 🔴 críticos y 🟠 medios mecánicos. Diferir lo que requiere decisión de producto (denormalizar `tienda_id`, hosting, MFA, features completas).

---

## 2. Lo que se implementó

### 2.1 Archivos creados

**Migraciones SQL** (`supabase/migrations/`):
- `20260508_001_security_hardening.sql` — REVOKE EXECUTE de anon/public en funciones definer; SET search_path en `update_updated_at`/`get_user_tiendas`/`get_stock`; recrea **15 policies** con `to authenticated` y `(select auth.uid())`.
- `20260508_002_perf_fk_indexes.sql` — 6 índices nuevos para FKs hot (`inventory_movements.producto_id`, `inventory_movements.created_by`, `sales.cashier_id`, `productos.categoria_id` parcial, `user_tiendas.tienda_id`, `cash_movements.created_by`).
- `20260508_003_close_cash_session_atomic.sql` — RPC nueva que reemplaza la lógica multi-query del cierre de caja con `select … for update` y validación de admin/owner.
- `20260508_004_audit_triggers.sql` — Triggers `tg_audit_producto_price` y `tg_audit_inventory_adjustment` que escriben en `audit_logs` cuando cambia precio/costo o se ajusta stock manualmente.

**Tests**:
- `supabase/tests/sale.test.sql` — Suite pgTAP con 8 casos para `create_sale_atomic` (UUID, persistencia, idempotencia, descuento de stock, pagos < total, stock insuficiente, cambio sólo desde efectivo, caja cerrada).

**Código Angular** (`apps/pos-angular/src/app/`):
- `core/observability/sentry.ts` — Wrapper defensivo con `initSentry()` y `reportError()`. Dynamic import → Sentry queda en chunk lazy. Sin DSN no se carga.

**Reportes**:
- `docs/sessions/2026-05-08-auditoria-arquitectura.md` — este spec.
- `docs/sessions/2026-05-08-auditoria-hallazgos.md` — reporte priorizado de hallazgos (~13 KB).

### 2.2 Archivos modificados

- `.github/workflows/ci.yml` — Renombra `NEXT_PUBLIC_SUPABASE_*` → `SUPABASE_*`, agrega `corepack enable`, mueve env al typecheck también, sustituye `pnpm test` por `pnpm test:coverage` y sube artefacto.
- `apps/pos-angular/src/app/app.config.ts` — Segundo `provideAppInitializer` que inicializa Sentry tras cargar runtime-config.
- `apps/pos-angular/src/app/core/config/app-config.service.ts` — Añade `sentryDsn?` y `environment` al `RuntimeConfig`.
- `apps/pos-angular/src/main.ts` — Reporta a Sentry el error de bootstrap.
- `apps/pos-angular/src/app/features/cash-register/cash-register.repository.ts` — `closeSession()` ahora invoca `close_cash_session_atomic` y vuelve a leer la sesión. Borra `normalize`, `PAYMENT_METHODS` y la rama `update` del `UntypedClient` ahora innecesaria.
- `apps/pos-angular/src/app/features/pos/pos-sale.service.ts` — Devuelve `Result<CreatePosSaleResult, CreatePosSaleError>` con error tipado (`unauthenticated` | `validation` | `remote`); valida input con Zod antes del RPC.
- `apps/pos-angular/src/app/features/pos/pos.page.ts` — `confirmSale()` consume el `Result` y mapea errores tipados al toast.
- `scripts/generate-runtime-config.mjs` — Lee `SENTRY_DSN`, `APP_ENV`/`NODE_ENV` y los emite en `runtime-config.json`.
- `src/infrastructure/supabase/database.types.ts` — Regenerado con MCP. Ahora incluye `close_cash_session_atomic`, `get_user_tiendas` (`Returns: string[]`) y todos los enums.
- `package.json` / `pnpm-lock.yaml` — Añade `@sentry/angular@^9` (peer warning para Angular 21, funcional).

### 2.3 Archivos eliminados

Ninguno.

---

## 3. Decisiones tomadas

| Decisión | Razón |
|---|---|
| Aplicar migraciones 1-3 al remote vía MCP | DB demo con pocos datos; cambios aditivos seguros y reversibles |
| Mantener migración 4 (audit triggers) sólo en repo | El classifier auto-mode bloqueó la 4ª; aplicarla manualmente con `supabase migration up` |
| Indexar sólo FKs hot en migración 2 | Las frías (`audit_logs.user_id`, `sales.voided_by`, `cash_sessions.closed_by`, `sales.billing_document_id`) no justifican el costo; re-evaluar a 30 días |
| Sentry vía dynamic import | Mantiene Sentry fuera del bundle principal; sin DSN no se descarga el chunk |
| `Result<T,E>` sólo en `PosSaleService` | El resto se migrará progresivamente; éste es el flujo más crítico |
| No tocar `S6` (denormalizar `tienda_id`) | Requiere ADR + decisión de producto sobre trade-off |
| No tocar `S5`/`S4` (MFA, leaked-password) | Configuración del Auth Dashboard, fuera de SQL |
| No reescribir `void_sale_atomic` ni `get_user_tiendas` | Siguen siendo `SECURITY DEFINER` por necesidad (validan `auth.uid()` o bypassan RLS); el linter siempre los advertirá |

---

## 4. ADRs creados o actualizados

Pendientes de redactar en sesión próxima:
- ADR sobre hosting frontend (Cloudflare Pages vs alternativas).
- ADR sobre denormalizar `tienda_id` en `payments`/`sale_items`/`cash_movements`/`billing_events` (S6).

---

## 5. Tests

### Validación final

- [x] `corepack pnpm typecheck` — pasó. Build dev OK en ~22 s.
- [x] `corepack pnpm lint` — pasó (`All files pass linting`).
- [x] `corepack pnpm test` — 16 archivos · **117 tests · 0 fallos**.
- [ ] `supabase test db --file supabase/tests/sale.test.sql` — no ejecutado (requiere `supabase start` local con Docker).

### Estado del Database Linter

| Categoría | Antes | Después |
|---|---:|---:|
| `function_search_path_mutable` (security) | 3 | **0** |
| `anon_security_definer_function_executable` (security) | 2 | **0** |
| `auth_rls_initplan` (performance) | 3 | **0** |
| `unindexed_foreign_keys` (performance) | 10 | **4** (frías intencionales) |
| `authenticated_security_definer_function_executable` | 2 | 3 (intencional, validan `auth.uid()`) |
| `auth_leaked_password_protection` | 1 | 1 (config Auth Dashboard) |

---

## 6. Bloqueos y preguntas pendientes

- **Aplicar migración `20260508_004_audit_triggers.sql`**: bloqueada por auto-mode; correr `corepack pnpm db:migrate` o aplicar manual desde Studio.
- **Activar leaked-password protection** en Supabase Dashboard → Authentication → Password security.
- **Decisión de hosting** (sin ello, CI/CD no llega a producción).
- **Decisión sobre `tienda_id` denormalizado** (S6).

---

## 7. Próximos pasos

1. Aplicar la 4ª migración local + remote.
2. Activar leaked-password protection.
3. ADR de hosting + ADR de `tienda_id` denormalizado.
4. Migrar `Result<T,E>` al resto de presenters (cash-register, products, customers).
5. Setup `@analogjs/vitest-angular` para tests de componentes/presenters Angular.
6. Implementar import CSV Siigo (M9) y descuentos con permiso por rol (M4).
7. Suite Vitest de integración contra `supabase start` para `void_sale_atomic` y `close_cash_session_atomic` (T2 hace falta cubrirla más allá del pgTAP de venta).

---

## 8. Notas adicionales

### Sentry y Angular 21
`@sentry/angular@9.47.1` declara peer `>= 14.x <= 20.x` pero funciona con Angular 21 (no usa APIs removidas). El peer warning queda registrado; revisar cuando Sentry libere v10 o un changelog específico para A21.

### Cambios en RPC vs SDK
El `cash-register.repository.ts` ya no contiene la lógica de cierre — vive en `close_cash_session_atomic`. La interfaz pública (`closeSession(input): Promise<CashSession>`) se mantiene, así que el diálogo `close-session.dialog.ts` no requiere cambios.

### Auditoría — hallazgos atendidos vs. pendientes

| ID | Estado |
|---|---|
| T1, C1 (CI roto) | ✅ |
| S1 (anon EXECUTE) | ✅ |
| S2 (search_path) | ✅ |
| S3 (`to authenticated`) | ✅ |
| P1 (`auth_rls_initplan`) | ✅ |
| P2 (FKs hot indexadas) | ✅ |
| P4 (close_cash_session RPC) | ✅ |
| A1 (database.types regenerados) | ✅ |
| A6 (audit triggers) | ✅ archivo, ⏳ aplicar |
| O1 (Sentry) | ✅ |
| T4 (pgTAP) | ✅ |
| T5 (coverage en CI) | ✅ |
| V1 + A2 parcial (Result+Zod en POS) | ✅ |
| S4 (leaked-password) | ⏳ Dashboard |
| S5 (MFA) | ⏳ post-MVP |
| S6 (`tienda_id` denormalizado) | ⏳ ADR |
| C3 (hosting) | ⏳ ADR |
| T2 (tests integración) | 🟡 Parcial — pgTAP cubre venta; falta close + void integrados |
| T3 (vitest-angular) | ⏳ próxima sesión |
| A2 completo (Result en todos los repos) | ⏳ migración progresiva |
| A3, A4 (interfaces, doc) | ⏳ |
| Gaps MVP (descuentos por rol M4, importador CSV M9) | ⏳ feature work |
