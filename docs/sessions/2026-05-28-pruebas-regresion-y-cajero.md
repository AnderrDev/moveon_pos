# Spec de Sesión — 2026-05-28 — Pruebas de regresión post-fixes + usuario cajero

> Continuación de `2026-05-27-status-y-consolidacion-wip.md`. El trabajo cruzó la medianoche.

---

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-05-28 |
| Sprint | Cierre P0 / pre-Sprint 5 |
| Agente | Claude Code (pipeline architect → developer → auditor + QA manual) |
| HUs trabajadas | PLAN-01..07, PLAN-15 (validación); AUTH-04 (TC-R02b) |
| Estado | Completada (P0 + regresión) |

---

## 1. Objetivo de la sesión

1. Aplicar al Supabase remoto las migraciones pendientes (PLAN-01 timezone, PLAN-03 sale_counters).
2. Re-ejecutar **todas** las pruebas manuales en el navegador con un plan paso a paso.
3. Crear un usuario cajero de prueba y cerrar la verificación del guard por rol (TC-R02b).

---

## 2. Lo que se hizo

### 2.1 Migraciones aplicadas al remoto (vía psql, idempotentes)
- `20260527_001_add_tienda_timezone` → `tiendas.timezone = America/Bogota`.
- `20260527_002_correlative_sale_number` → tabla `sale_counters` + RPC `create_sale_atomic` con correlativo. Verificado: sin colisión con ventas existentes.

### 2.2 Pruebas de regresión (navegador, Playwright MCP)
- Plan: `docs/user-stories/PLAN-DE-PRUEBAS-post-fixes.md`. **19/19 casos ejecutables PASS.**
- Confirmado en vivo: V-000001/V-000002/V-000003 correlativos; reporte por día local (TZ); form de producto (IVA/costo); cliente + descuentos (persistido en DB); paste en moneda (evento real); tope de stock; historial por sesión; anulación repone stock; cierre atómico; guard por rol (admin y cajero).

### 2.3 Usuario cajero
- Creado `cajero@moveonpos.co` (rol `cajero`, activo) vía `scripts/create-cajero-test-user.sh` (ejecutado por el usuario con `!` por política de seguridad sobre service role). Contraseña rotada el 2026-07-06; ya no se documenta en texto plano.

### 2.4 Archivos creados
- `scripts/create-cajero-test-user.sh` — helper idempotente para el cajero de prueba.
- `docs/user-stories/PLAN-DE-PRUEBAS-post-fixes.md` — plan + resultados (ya commiteado parcialmente).

---

## 3. Decisiones

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| Aplicar migraciones por `psql` directo | `supabase db push` | Naming de migraciones del repo no mapea limpio al historial remoto; psql idempotente es más controlado |
| Crear cajero por script `!` | MCP de Supabase | El MCP está `Unauthorized` (token PAT expirado) y requiere reinicio; el classifier bloqueó el service role desde mi Bash |

---

## 4. Hallazgos nuevos (candidatos a nuevos PLAN)

- **F-A (alta):** caja por-tienda en la UI vs por-cajero en `create_sale_atomic`. Con 2 usuarios el cajero no puede vender/abrir su caja y ve la del admin. Alinear modelo UI+RPC+RLS.
- **F-B (media):** `sale-error-mapper` no mapeó "No hay caja abierta para esta venta" (mostró genérico). Revisar matching.

---

## 5. Tests
- [x] Migraciones verificadas en remoto.
- [x] QA manual navegador: 19/19 PASS.
- [ ] pgTAP (`sale-number.test.sql`): pendiente (Docker local apagado).

---

## 6. Próximos pasos
1. Atender F-A (modelo de caja multi-usuario) y F-B (mapper) — crear PLAN-19/20.
2. Continuar P1 (PLAN-08..14) y P2 (PLAN-16..18) con el mismo pipeline.
3. Correr pgTAP cuando Docker esté disponible.
4. Renovar el PAT del MCP de Supabase en `.mcp.json` y reiniciar Claude Code si se quiere usar el MCP.

---

## 7. Notas
- Datos de prueba en staging: producto `TESTQA02`, ventas `V-000001` (anulada)/`V-000002` (cliente+desc.)/`V-000003`, usuario `cajero@moveonpos.co`, sesiones de caja (una del admin abierta).
- El service role key y la contraseña de DB siguen en `.env.local`; recordatorio de rotarlos (quedaron expuestos en chat de sesiones previas).

---

## 8. PLAN-16 — Recuperación de contraseña (Supabase Auth) [añadido 2026-05-28]

Implementado el flujo cliente-only de reset de contraseña (AUTH-05). Pipeline architect → developer.

**Creado**
- Forms TS puro: `src/modules/auth/forms/forgot-password-form.{factory,mapper}.ts`, `reset-password-form.{factory,mapper}.ts`.
- Feature: `apps/pos-angular/src/app/features/auth/forgot-password.page.ts`, `reset-password.page.ts`, sus presenters, y `reset-password-error-mapper.ts`.
- Tests: `tests/unit/modules/auth/forgot-password-form.test.ts`, `reset-password-form.test.ts`, `tests/unit/app/features/auth/reset-password-error-mapper.test.ts`.

**Modificado**
- `login.page.ts`: link "¿Olvidaste tu contraseña?" → `/recuperar-contrasena` (login intacto).
- `app.routes.ts`: 2 rutas públicas hermanas de `login` (fuera del shell/authGuard).
- `core/auth/session.service.ts`: `requestPasswordReset(email, redirectTo)` y `updatePassword(password)` (estilo `signIn`, devuelven `{ error }`).
- `docs/modules/auth.md`: sección "Recuperación de contraseña (AUTH-05)" + config manual de Supabase.

**Decisiones**
- Mensaje de éxito SIEMPRE genérico tras `resetPasswordForEmail` (no enumeración); solo se informan 429 y red.
- Páginas públicas usan feedback inline (no hay `mo-toast-host` fuera del shell); el toast del reset se ve al navegar a `/pos`.
- `redirectTo` = `window.location.origin + '/restablecer-contrasena'` (no se añadió `appUrl` al RuntimeConfig).
- Botón de submit nativo full-width (igual que `/login`) en vez de `mo-button` porque `mo-button` no se estira a ancho completo vía clases del host (desviación menor — ver reporte del developer).

**Pendiente (config del usuario, NO aplicada)**
- Supabase: Site URL, Redirect URLs allowlist con `<origin>/restablecer-contrasena` (incl. `localhost:4200`), plantilla "Reset Password".

**Verificación:** `pnpm typecheck`, `pnpm lint`, `pnpm test` verdes.

---

## 9. PLAN-22..26 — Rebaseline + inventario por ubicación (Codex) [añadido 2026-05-29]

Implementado el bloque completo acordado para separar inventario entre **Punto de venta** y **Bodega**.

**PLAN-22 — Rebaseline documental / seguridad local**
- `.codex/` agregado a `.gitignore` porque puede contener tokens MCP locales.
- ADR 0008 queda como decisión arquitectónica a trackear.
- Actualizados docs vivos: visión Angular, alcance MVP, modelo de datos, módulos `inventory/sales/products/reports`, user stories, flujos E2E y `docs/plan-de-trabajo.md`.

**PLAN-23 — DB/RPC**
- Creadas y aplicadas al Supabase remoto:
  - `supabase/migrations/20260529_001_inventory_locations.sql`
  - `supabase/migrations/20260529_002_inventory_location_rpcs.sql`
- `inventory_movements.ubicacion` (`punto_venta`/`bodega`) con backfill/default `punto_venta`.
- `get_stock(producto, tienda, ubicacion default 'punto_venta')`.
- `create_sale_atomic` valida/descuenta `punto_venta`.
- `void_sale_atomic` repone `punto_venta`.
- Nuevo `transfer_stock_atomic` admin-only, atómico, con `transfer_out` + `transfer_in` y protección de stock origen.

**PLAN-24 — Dominio/DTOs/importador**
- Tipos `InventoryLocation` y movimientos `transfer_out`/`transfer_in`.
- `StockLevel` ahora expone `puntoVentaStock`, `bodegaStock`, `totalStock`; bajo stock usa PV.
- DTOs Zod para ubicación y traslado.
- Importador Siigo genera `entry` en `bodega`.
- Tipos Supabase regenerados desde remoto.

**PLAN-25/26 — UI, POS y reportes**
- `/inventario` muestra PV/Bodega/Total/Min, entrada por defecto a bodega, ajuste con ubicación, nuevo diálogo "Trasladar", kardex con ubicación.
- POS usa PV como `stockDisponible`; `prepared` sigue sin tope.
- `/reportes` muestra PV/Bodega/Total y alerta bajo stock por PV.

**Verificación**
- `corepack pnpm typecheck` ✅
- `corepack pnpm lint` ✅
- `corepack pnpm test` ✅ — 34 files / 299 tests.
- Migraciones aplicadas a staging vía `psql` + `notify pgrst, 'reload schema'` ✅
- `supabase/tests/inventory-locations.test.sql` contra staging ✅ — 7/7 pgTAP, con rollback.

**Pendiente**
- Rotar service-role key (acción manual del usuario; PLAN-21).
- Configurar Supabase Auth Redirect URLs/plantilla para reset password (acción dashboard).
- QA manual navegador del nuevo flujo PV/Bodega antes de go-live: entrada a bodega, traslado a PV, venta descuenta PV, anulación repone PV, reportes/kardex.
