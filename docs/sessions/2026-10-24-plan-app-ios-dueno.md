# Spec de Sesión — 2026-10-24 — App iOS del dueño: planeación, PLAN-75 y PLAN-76

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-10-24 |
| Sprint | Planeación (bloque ADR 0021) |
| Agente | Claude Code |
| HUs trabajadas | Ninguna (planeación) |
| Estado | Completada — ADR 0021 aprobado; PLAN-75 y PLAN-76 hechos (sin commit) |

---

## 1. Objetivo de la sesión

Revisar todo el contexto de MOVE ON POS para decidir cómo construir una app móvil en Swift, y redactar el ADR y el plan. El dueño definió que la v1 es **para él como dueño**: dashboard de ventas, caja, stock y finanzas desde el iPhone.

---

## 2. Lo que se implementó

### 2.1 Archivos creados
- `docs/adr/0021-app-ios-dueno-swift.md` — decisión de app iOS nativa (SwiftUI, solo admin, solo lectura en v1).
- `docs/sessions/2026-10-24-plan-app-ios-dueno.md` — este spec.

### 2.2 Archivos modificados
- `docs/plan-de-trabajo.md` — nuevo bloque "App iOS del dueño" con PLAN-75..84.

Sin cambios de código ni de base de datos.

---

## 3. Decisiones tomadas

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| v1 solo lectura | Incluir registrar gastos/ajustes | Evita duplicar validaciones Zod en Swift desde el día uno |
| Agregados en RPC SQL `owner_*` con test de paridad | Portar a Swift las reducciones TS de `/reportes` | `getDailyReport` y `buildFinancialSummary` calculan en el cliente; portarlos daría cifras distintas entre iPhone y web |
| `apps/ios-owner/` en el monorepo | Repo aparte | Misma fuente de verdad en `/docs` y migraciones al lado |
| Solo dependencia `supabase-swift` | Librerías de gráficas/DI | Swift Charts y Observation vienen con iOS |
| No se actualizó todavía `01-mvp-scope.md` ni ADR 0004 | Editarlos ya | El ADR está Propuesto; se actualizan en PLAN-75 al aprobarse |

---

## 4. ADRs creados o actualizados

- `docs/adr/0021-app-ios-dueno-swift.md` — app iOS nativa del dueño; modifica ADR 0004 al aceptarse.

---

## 5. Tests

No aplica (solo documentación).

---

## 6. Bloqueos y preguntas pendientes

- [ ] ¿Se crea la cuenta Apple Developer (99 USD/año) para TestFlight, o se empieza con firma personal (expira cada 7 días)?
- [ ] Hallazgo previo sin resolver: la migración `20260814000100` (`correct_inventory_entry_cost_atomic`) no está aplicada al remoto (ver spec `2026-10-24-integrar-trabajo-pendiente-dev.md`). No bloquea la app iOS.

---

## 7. Próximos pasos

1. PLAN-77: login + gate de rol admin + Face ID (reemplaza `HomePlaceholderView`).
2. PLAN-78: RPC `owner_sales_summary` con test de paridad contra `getDailyReport` (Supabase local).
3. PLAN-79: dashboard "Hoy".

---

## 9. Continuación — PLAN-75 y PLAN-76 (mismo día)

El dueño aprobó el ADR 0021.

**PLAN-75:** ADR 0021 → Aceptado; ADR 0004 con estado "modificado por ADR 0021" y sección de modificación; fila de app móvil en `01-mvp-scope.md` reescrita como excepción fuera del MVP; creado `docs/modules/ios-owner.md`. La cuenta Apple Developer sigue sin decidir (solo hace falta en PLAN-84).

**PLAN-76:** creado `apps/ios-owner/`:
- `project.yml` (XcodeGen; el `.xcodeproj` se genera y no se versiona — evita conflictos de `project.pbxproj`). iOS 17+, Swift 6, concurrencia estricta, solo iPhone vertical, bundle `co.moveon.owner`.
- `Packages/MoveOnKit`: target `Domain` sin dependencias (`CurrencyFormatter`, `StoreCalendar` espejo de `day-range.ts`) y `Data` con `supabase-swift` 2.55.4 (`SupabaseSettings`, `SupabaseClientFactory`). La frontera la impone `Package.swift`.
- App: `AppConfig` (lee URL/anon key del Info.plist ← `Config/App.xcconfig`), `AppContainer` (composition root), `Theme` (negro + #F9D128), `ConfigErrorView`, `HomePlaceholderView`.
- `Config/App.xcconfig` versionado apunta a Supabase LOCAL con la anon key demo pública; `Local.xcconfig` (ignorado) para producción.
- `scripts/ios-test.sh`: tests del paquete + `xcodegen generate` + `xcodebuild test`.

**Verificación:** `scripts/ios-test.sh` → 11 tests de MoveOnKit y 4 de la app en verde (`TEST SUCCEEDED`); la app abre en el simulador mostrando la pantalla temporal con "Supabase local". No se tocó código Angular ni SQL, así que no se corrió `pnpm`.

**Aviso:** durante la sesión aparecieron cambios ajenos sin confirmar en el workspace (`cash-register.repository.ts`, migración `20261024000200_lock_direct_writes_sales_cash_audit.sql`, `supabase/tests/lock-direct-writes.test.sql`, spec `2026-10-24-auditoria-arquitectura-solid.md`). No son de esta sesión y no se tocaron.

## 10. Continuación — repo propio para la app

El dueño pidió que la app viva en un repo nuevo. Se movió `apps/ios-owner/` a `/Users/ander/Documents/moveonapp-pos-planeacion/moveon-owner-ios` (git nuevo, rama `main`), con `README.md`, `CLAUDE.md` (apunta a `/docs` de este repo), `AGENTS.md` y `scripts/test.sh` (antes `scripts/ios-test.sh` aquí, borrado). Se agregó ADR 0021 §7 (enmienda) y se actualizaron el módulo y la fila PLAN-76. Docs, plan, specs y RPC `owner_*` siguen en este repo. La decisión de la tabla §3 "`apps/ios-owner/` en el monorepo" queda reemplazada por esta.

## 11. Continuación — PLAN-77 (login, gate de rol, Face ID)

Hecho en `moveon-owner-ios` (commit `8173761`): dominio de sesión y política de acceso, repositorio Supabase con mapeo de errores igual al web, login, recuperación de contraseña (enlace a `/restablecer-contrasena` del POS web, nueva clave `PASSWORD_RESET_URL` en `App.xcconfig`), bloqueo con Face ID/código. Detalle en `docs/modules/ios-owner.md` §Autenticación.

**Tests:** paquete 33 en verde; app 15 en verde (`AppSession`: restaurar, bloquear/desbloquear, admin, cajero denegado con cierre de sesión, validación sin red, recuperación genérica).

**QA en simulador contra Supabase local:** `cajero@moveon.local` → "Acceso solo para el dueño…"; `admin@moveon.local` → entra; reabrir la app restaura la sesión y pide desbloqueo con el código del iPhone (el simulador no tiene Face ID enrolado, así que no se probó la cara; sí el flujo de bloqueo). No se probó el envío real del correo de recuperación (requiere SMTP local/Inbucket, que estaba detenido).

**Ajuste a pedido del dueño ("con contraseña o Face ID es más que suficiente"):** se quitó el bloqueo en segundo plano y el respaldo con el código del iPhone. Con sesión guardada: Face ID o "Entrar con contraseña"; sin Face ID en el teléfono, login con contraseña. Verificado en simulador: sin Face ID enrolado → login; con Face ID enrolado → aviso de Face ID y entrada al simular coincidencia. 16 tests de la app en verde (repo iOS, commit siguiente a `8173761`).

**Datos de prueba creados (solo local):** usuario `cajero@moveon.local` con fila `user_tiendas` rol `cajero` en la tienda demo.

## 12. Continuación — reglas de `gym_ios`

El dueño pidió que las reglas del proyecto sean iguales a las de `gym_ios` (`~/Desktop/gym_ios`). Hecho en `moveon-owner-ios` (commit `1a8ee5b`):

- `docs/ENGINEERING_RULES.md`: §1–11 copiadas de `gym_ios` (solo cambian nombres, rutas y ejemplos); §12 con las decisiones de esta app (backend y spec en el POS, solo lectura, un solo target, modo oscuro de marca, Face ID o contraseña, recuperación por el web, textos del web, tests de UI pendientes para PLAN-79). `CLAUDE.md` con el mismo formato; se quitó `AGENTS.md` (gym_ios no lo tiene).
- Reestructura a un solo target (`App/Core/Data/Features`), sin `MoveOnKit`. Se eliminaron `CurrencyFormatter` y `StoreCalendar` (sin uso aún; YAGNI): vuelven en PLAN-79 a `Core/Formatting` y `Core/Dates`.
- `AppError` + `UserMessages`, `SupabaseErrorMapper`, `AppLogger`, `Validators`, tokens `AppColors/AppFont/AppMetrics`, componentes (`BrandMark`, `PrimaryButton`, `LinkButton`, `AppTextField`, `ErrorBox`, `ModelHost` copiado de gym_ios).
- Secretos: `Config/Secrets.xcconfig` (fuera de git) con `scripts/make_secrets.sh` (Supabase local por defecto). Se quitó `scripts/test.sh`.
- ADR 0021 §8 y `docs/modules/ios-owner.md` actualizados.

**Tests:** 50 en verde (Swift Testing, nombres en español), sin avisos del compilador en archivos propios. **Simulador** (contra Supabase local): Face ID con la sesión guardada → entra; cerrar sesión → login; login legible con texto grande (accessibility-medium). El rechazo del cajero quedó cubierto por tests; contra el backend real se había verificado antes de la reestructura con la misma consulta.

**Pendiente:** tests de UI y modo demo (`-demo`) con PLAN-79; VoiceOver no se revisó.

## 13. Continuación — push del repo iOS y PLAN-78

- `moveon-owner-ios`: `main` subido a GitHub (`1a8ee5b`).
- **PLAN-78 (POS):**
  - `reports/domain/services/sales-summary.ts`: `buildSalesSummary(sales, timezone)` con la parte pura de `getDailyReport`. `reports.repository.ts` la usa sin cambiar su salida. 6 tests unitarios nuevos.
  - Migración `20261024120000_owner_sales_summary.sql`: RPC de solo lectura, solo admin, con rango en la zona de la tienda (contrato en `docs/modules/ios-owner.md`).
  - Paridad: `pnpm test:parity` → 10 tests en verde contra el Supabase local; deja la base como estaba.
- **Verificación:** `pnpm test` 786 en verde; `pnpm lint` en verde; `tsc --noEmit` y `ng build --configuration development` sin errores. El typecheck se corrió sin el hook `pretypecheck` para no reapuntar `runtime-config.json` a producción: había un servidor de desarrollo de otra sesión usando esta carpeta.
- **Base local:** estaba atrasada; `supabase migration up --local --include-all` aplicó hasta `20261024000200`. Se detuvo en `20261024000300_lock_direct_writes…` (de otra sesión) porque sus políticas ya estaban aplicadas a mano en local sin registro; no se tocó. `20261024000400/500` siguen sin registrar en local. La RPC nueva se aplicó con psql y se registró en `schema_migrations`.
- **Remoto:** `owner_sales_summary` NO está aplicada en producción; pendiente de confirmación del dueño.

## 8. Notas adicionales

- Fuentes de datos ya existentes para la app: `get_stock_levels`, `get_monthly_sales_totals`, `get_monthly_expense_totals`, `get_reinvestment_fund_totals`, `list_cash_history_days`.
- Lógica TS que las RPC nuevas deben reproducir (con test de paridad): `reports/data/repositories/reports.repository.ts#getDailyReport`, `reports/domain/services/*`, `cash-register/domain/services/cash-closure.ts` y `cash-movement-summary.ts`, `expenses/domain/services/financial-summary.ts`, `inventory/domain/services/low-stock.ts`.
- RLS de gastos/empleados/plantillas ya es `admin_only`.
