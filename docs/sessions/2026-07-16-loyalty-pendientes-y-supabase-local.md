# Spec de Sesión — 2026-07-16 — Cierre de pendientes MOVE ON Club + Supabase local

---

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-07-16 |
| Sprint | Post-Sprint 4 (fidelización) |
| Agente | Claude Code |
| HUs trabajadas | PLAN-46, PLAN-57, PLAN-58, PLAN-59, PLAN-60 + drift `get_reinvestment_fund_totals` |
| Estado | Completada |

---

## 1. Objetivo de la sesión

Cerrar los 4 pendientes de la implementación MOVE ON Club (2026-07-14) y el drift de
migración, con la condición del dueño de **no tocar datos de producción**: todas las
pruebas se hicieron contra una instancia local de Supabase, lo que exigió resolver
primero PLAN-46 (nombres de migrations rotos que impedían `supabase db reset`).

---

## 2. Lo que se implementó

### 2.1 Archivos creados

**Fidelización (PLAN-57/58/59/60):**
- `apps/pos-angular/src/app/features/loyalty/cliente-loyalty.dialog.ts` — diálogo "Club" en `/clientes`: resumen (saldo, progreso X/N, recompensas vigentes), historial del ledger, y ajuste manual admin-only.
- `src/modules/loyalty/forms/adjust-stamps-form.factory.ts` + `adjust-stamps-form.mapper.ts` — schema Zod del ajuste (delta ≠ 0 entero ±99, motivo 3–200) + payload del RPC.
- `src/modules/settings/forms/loyalty-settings-form.factory.ts` + `loyalty-settings-form.mapper.ts` — schema Zod de la config del programa (activo, sellos 1–50, valor 0–10M, vigencia 1–365).
- `apps/pos-angular/src/app/features/settings/loyalty-settings.service.ts` + `loyalty-settings-form.presenter.ts` — load/save de `settings.data.fidelizacion` (admin-only, espejo del patrón receipt-settings).
- `src/modules/loyalty/domain/services/program-report.ts` — dominio puro del reporte (KPIs del período + top clientes).
- `apps/pos-angular/src/app/features/reports/loyalty-report.service.ts` + `loyalty-report.component.ts` — queries + tab "Fidelización" en `/reportes`.
- `supabase/migrations/20260716000100_loyalty_expire_sweep.sql` — RPC `expire_loyalty_rewards(p_tienda_id)`: marca `expired` + transacción `expire` (delta 0) en el ledger + audit log. Invocado oportunistamente desde el diálogo Club y el reporte (sin cron, ADR 0013 §7).
- Tests: `tests/unit/modules/loyalty/adjust-stamps-form.test.ts`, `tests/unit/modules/loyalty/program-report.test.ts`, `tests/unit/modules/settings/loyalty-settings-form.test.ts`.

**Reparación de migrations (PLAN-46):**
- `supabase/migrations/20260705040508_register_expense_atomic_defaults.sql` — reconstruida desde `supabase_migrations.schema_migrations` del remoto (existía solo allá).
- `supabase/migrations/20260716000200_table_grants_parity.sql` — grants DML estándar de Supabase sobre `public` (el remoto los tenía, una base local desde cero no) + re-aplicación de los revokes deliberados del storefront.

### 2.2 Archivos modificados

- **47 migrations renombradas** a las versiones de 14 dígitos del remoto (mapeo 1:1 con `schema_migrations`); las 4 sin registro remoto (catalogo/storefront ×2) recibieron versiones sintéticas que preservan el orden.
- `supabase/migrations/20260613000100_reclassify_product_catalog.sql` — insert de categorías de la tienda prod condicionado a que la tienda exista (fallaba en base local vacía).
- `supabase/migrations/20260624000100_catalogo_publico.sql` — ídem para combos + define `update_updated_at_column()` idempotente (en remoto existía ad-hoc).
- `supabase/migrations/20260615000400_audit_logs.sql` — `add column if not exists` para `user_email`/`entity_label`/`changes` (el `create table if not exists` se saltaba porque initial_schema ya creaba una versión más pobre; en remoto las columnas se agregaron ad-hoc).
- `supabase/migrations/20260708173522_reinvestment_fund.sql` — **drift reconciliado**: la función local ahora espeja el contrato real del remoto (5 columnas, sin `ventas_sin_costo`); comentario actualizado en `expenses.repository.ts`.
- `apps/pos-angular/src/app/core/tienda/tienda-info.service.ts` — `TiendaInfo.fidelizacion: LoyaltyConfig` parseado de `settings.data.fidelizacion` con defaults del dominio.
- `apps/pos-angular/src/app/features/pos/pos.page.ts` — `stampsPerReward` ahora es signal alimentado por la config de la tienda (ya no `DEFAULT_LOYALTY_CONFIG` hardcodeado).
- `apps/pos-angular/src/app/features/customers/clientes.page.ts` — botón "Club" por fila + wiring del diálogo.
- `apps/pos-angular/src/app/features/settings/configuracion.page.ts` — artículo "MOVE ON Club" con formulario y guardado propios.
- `apps/pos-angular/src/app/features/reports/reportes.page.ts` + `report-period.helpers.ts` — tab `loyalty` (sin export Excel en esta iteración).
- `apps/pos-angular/src/app/features/loyalty/loyalty.repository.ts` — método `expireRewards`.
- `apps/pos-angular/src/app/features/pos/customer-picker.dialog.ts` — eliminado `invalidate()` muerto (referenciaba una propiedad inexistente y rompía typecheck; residuo de la sesión anterior).
- `supabase/config.toml` — `[auth.email] enable_signup = true` (solo afecta local: sin esto GoTrue local rechaza el login por contraseña).
- `docs/modules/loyalty.md` y `docs/plan-de-trabajo.md` — estados actualizados.

### 2.3 Archivos eliminados
- N/A (renombrados sí, eliminados no).

---

## 3. Decisiones tomadas

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| Historial + ajuste en un solo diálogo desde `/clientes` | Página de detalle de cliente | No existe ficha de cliente; crearla excede el alcance |
| Drift `get_reinvestment_fund_totals`: archivo local espeja al remoto (sin `ventas_sin_costo`) | Re-desplegar la versión rica al remoto | No tocar producción en esta sesión; puede volver como migración deliberada |
| Vencimiento sin pg_cron: RPC invocado oportunistamente desde la UI | Edge Function programada | ADR 0013 §7 lo permite; cero infraestructura nueva |
| Versiones sintéticas (`YYYYMMDD000N00`) para migrations sin registro remoto | `supabase migration repair` contra remoto | Preserva el orden sin escribir en la tabla de migraciones de prod |
| Migración de paridad de grants en el repo (no solo fix local) | Script local ad-hoc | Cada `db reset` futuro la necesita; en remoto es no-op |

---

## 4. ADRs creados o actualizados

- N/A — todo dentro de lo ya decidido en ADR 0013.

---

## 5. Tests

- `pnpm test`: 508/508 (incluye los 23 de esta sesión). `pnpm typecheck` y `pnpm lint` en verde.
- **E2E contra Supabase local** (stack desde cero con las 49 migraciones + seed de prueba):
  - SQL (simulando JWT): 7 batidos → 7 sellos; +3 → recompensa generada y quedan 2 (ejemplo oficial); canje batido $12.000 → paga $1.000, reward `redeemed`; doble canje rechazado; anulación → reversa truncada en 0 con motivo (RN-LF14); ajuste +16 → 2 recompensas; barrido → `expired` + tx `expire`; escritura directa a `loyalty_accounts` bloqueada por RLS (0 filas).
  - UI (Playwright): login admin; diálogo Club con resumen/historial/ajuste (+2 aplicado y reflejado); `/configuracion` guarda `sellosParaRecompensa=10` y el RPC + POS + diálogo pasan a mostrar X/10; tab "Fidelización" en `/reportes` con KPIs correctos; venta completa en POS con canje (total $1.000, `loyalty_discount_total=11000`, la unidad canjeada no genera sello).

---

## 6. Bloqueos y preguntas pendientes

- **`expire_loyalty_rewards` NO está en el remoto** — la migración `20260716000100` (y el registro de `20260716000200`) quedan listas para aplicar cuando el dueño confirme. Mientras tanto la UI las invoca con catch silencioso: todo funciona, solo que las recompensas vencidas siguen mostrándose por evaluación perezosa.
- Los fixes de migraciones "prod-data en base vacía" no cambian nada en remoto (ya aplicadas); solo importan para resets locales.
- Drift documental: en remoto existen sin registro de migración las 4 de catalogo/storefront; si algún día se usa `db push`, hará falta `supabase migration repair`.
- El CLI de Supabase se actualizó 2.34.3 → 2.109.1 (el viejo no parseaba los cuerpos `$$`). `supabase/.temp/storage-version` tenía fijado un tag inexistente (`optimize-existing-functions-again`) — se borró; es estado temporal local.

---

## 7. Próximos pasos

1. **Commitear todo el trabajo acumulado** (fidelización 07-14, finanzas, reportes, esta sesión) — sigue siendo el mayor riesgo del repo.
2. Aplicar al remoto `20260716000100_loyalty_expire_sweep.sql` (con confirmación) y registrar `20260716000200`.
3. `pnpm db:types` para incorporar las tablas loyalty a `database.types.ts` y retirar los clientes estructurales.
4. pgTAP local ya desbloqueado (PLAN-46) — escribir los tests SQL pendientes de PLAN-52.
5. Operativizar el registro de clientes en el POS (hallazgo del estudio 2026-07-16: 0 de 571 ventas con cliente).

---

## 8. Notas adicionales

- **Receta Supabase local:** `supabase start` (Docker), usuario de prueba vía GoTrue admin API (`admin@moveon.local` / `Test1234!`), seed en el scratchpad de la sesión. La app se apunta a local con **`pnpm dev:local`** (script agregado en `package.json`; su `predev:local` genera el runtime-config con la anon key demo del CLI). `pnpm dev` normal vuelve a producción.
- El intento de escritura directa a las tablas loyalty vía PostgREST devuelve `[]` (0 filas) en vez de error: RLS solo-SELECT sin políticas de escritura.
