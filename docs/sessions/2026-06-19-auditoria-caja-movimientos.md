# Spec de Sesión — 2026-06-19 — Auditoría de movimientos de caja y anulación de cash_movements

---

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-06-19 |
| Sprint | N/A (auditoría + hardening del módulo de caja) |
| Agente | Claude Code |
| HUs trabajadas | N/A |
| Estado | Completada |

---

## 1. Objetivo de la sesión

El usuario reportó "algo raro" la noche anterior (2026-06-18) al registrar una salida de efectivo en la caja, y pidió auditar el módulo `cash-register` (gastos, entradas y salidas de efectivo).

---

## 2. Hallazgo de la auditoría

Se consultó directamente la tabla `cash_movements` en producción (proyecto Supabase `POS`, `rmaieqyscchtxxkgxgik`). En la sesión `30eb1fa1…` (abierta 2026-06-18 22:21, cerrada 2026-06-19 02:58) aparecen dos movimientos consecutivos:

| Hora | Movimiento | Motivo |
|---|---|---|
| 02:55:36 | Salida de efectivo $36.000 | "Anderson cerro caja" |
| 02:58:29 | Entrada de efectivo $36.000 | "Correccion entrada" |
| 02:58:49 | Cierre de caja | diferencia $0 |

No hay ninguna venta de $36.000 alrededor de esa hora (la última venta fue V-000063 a las 02:33 por $150.000). El cierre cuadró en $0 — **no hubo pérdida de dinero ni bug de cálculo**. La causa raíz es de diseño: el módulo no tenía forma de editar/anular un `cash_movement` mal registrado, así que la única manera de "corregirlo" era crear un movimiento inverso manual sin ningún vínculo estructurado (solo el texto libre de `motivo`).

Otros hallazgos menores, no atacados en esta sesión (quedan en "Próximos pasos"):
- El tipo `correction` existe en el schema/UI pero no está documentado en RN-C03 y siempre se trata como resta (igual que `cash_out`/`expense`) tanto en `caja.page.ts` como en `close_cash_session_atomic` — si alguna vez se usa para sumar, hoy restaría igual.
- El selector "Tipo" del diálogo de movimiento siempre abre en "Entrada de efectivo" (no vacío), lo que facilita registrar el tipo equivocado por descuido.
- RLS de `cash_movements` es `tenant_isolation for all` sin restricción por `created_by` ni por estado de sesión (mismo patrón que `sales`, no es exclusivo de este módulo).

---

## 3. Lo que se implementó

Se priorizó (decisión del usuario): **agregar anulación de movimientos de caja con auditoría**, espejo de `void_sale_atomic`.

### 3.1 Base de datos (aplicado en producción, `apply_migration`)

- `supabase/migrations/20260619_001_void_cash_movement.sql`:
  - `cash_movement_status` enum (`active`/`voided`) + columnas `status`, `voided_by`, `voided_at`, `voided_reason` en `cash_movements`.
  - RPC `void_cash_movement_atomic(p_movement_id, p_tienda_id, p_voided_by, p_voided_reason)`: solo `admin` activo de la tienda (mismo gate que `void_sale_atomic`), marca el movimiento como `voided` y registra en `audit_logs` (`action='cash_movement.voided'`).
  - `close_cash_session_atomic` redefinido para excluir movimientos `voided` del cálculo de `v_movs_total` (RN-C03) — cuerpo idéntico al vigente salvo ese filtro.
- Verificado con `information_schema.columns` y `get_advisors`: las nuevas columnas existen y `void_cash_movement_atomic` queda con el mismo perfil de seguridad (`SECURITY DEFINER`, ejecutable por `authenticated`) que `void_sale_atomic`/`correct_payment_atomic` — no es un riesgo nuevo, es el patrón ya establecido.

### 3.2 Dominio (`src/modules/cash-register`)

- `domain/entities/cash-session.entity.ts`: `CashMovement` ahora incluye `status`, `voidedBy`, `voidedAt`, `voidedReason`.
- `domain/repositories/cash-register.repository.ts`: `VoidMovementParams` + método `voidMovement` en la interfaz.
- `infrastructure/mappers/cash-register.mapper.ts`: `CashMovementRow`/`rowToCashMovement` mapean las columnas nuevas.
- `application/dtos/cash-register.dto.ts`: `voidMovementSchema` (zod), reutiliza el mismo umbral de motivo mínimo (10 caracteres) que la anulación de ventas.
- `src/shared/types/index.ts`: `CashMovementStatus = 'active' | 'voided'`.
- `src/modules/audit/domain/entities/audit-log.entity.ts`: se agregó `'movimiento_caja'` a `AuditEntityType`.

### 3.3 Angular (`apps/pos-angular`)

- `core/auth/role-policy.ts`: `canVoidCashMovement(rol)` — solo `admin`.
- **Refactor de reutilización**: `void-reason.dialog.ts` y `void-reason.ts` (antes específicos de `features/pos/`, usados solo para anular ventas) se movieron a `shared/feedback/` y se generalizaron (`saleNumber` → `targetLabel` + `title` configurable), porque ahora los usan 2 features (`pos` y `cash-register`) — regla del estándar de componentes (`docs/standards/ui-components.md` §3.1). `sales-history.dialog.ts` se actualizó al nuevo import/props sin cambiar su comportamiento.
- `features/cash-register/cash-register.repository.ts`: método `voidMovement` (llama al RPC + `audit.log` cliente, mismo patrón que `voidSale` en `sales.repository.ts`).
- `features/cash-register/caja.page.ts`:
  - `movementsTotal` ahora excluye movimientos `voided` (coherente con el RPC de cierre).
  - Tabla "Movimientos del turno": badge "Anulado", motivo tachado + motivo de anulación visible, botón "Anular" (solo si `canVoid()` y el movimiento está `active`).
  - Diálogo `mo-void-reason-dialog` reutilizado para pedir motivo y confirmar.
- `features/pos/sales-export.ts`: el sheet "Movimientos de caja" del Excel del turno ahora incluye columnas "Estado" y "Motivo de anulación", y `CASH_MOVEMENT_LABELS` se completó con `expense`/`correction` (antes solo tenía `cash_in`/`cash_out`, así que esos dos tipos salían con el valor crudo del enum en el Excel).

### 3.4 Tests

- `tests/unit/modules/cash-register/cash-register-dto.test.ts`: 3 casos nuevos para `voidMovementSchema`.
- `tests/unit/modules/sales/create-sale-use-case.test.ts`: mock de `CashRegisterRepository` actualizado con `voidMovement` (requerido por el tipo de dominio).
- `tests/unit/app/features/pos/void-reason.test.ts` → movido a `tests/unit/app/shared/feedback/void-reason.test.ts` (sigue al archivo de origen).
- `pnpm typecheck`, `pnpm test` (350/350), `pnpm lint` (sin errores nuevos; los 8 errores/3 warnings preexistentes están en archivos no tocados en esta sesión).

---

## 4. Decisiones tomadas

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| Anular movimientos restringido a `admin` | Permitir que cualquier cajero anule sus propios movimientos | Mismo criterio que `void_sale_atomic` (PLAN-15): la caja es compartida para operar, pero anular requiere un nivel de confianza distinto — un cajero no debe poder borrar su propio rastro. |
| Mover `void-reason.dialog.ts`/`void-reason.ts` a `shared/feedback/` y generalizarlo | Duplicar un diálogo de anulación específico para `cash-register` | Es el mismo patrón UI (motivo mínimo 10 caracteres, mismo flujo) usado ahora en 2 features — el estándar de componentes pide moverlo a `shared/` en ese caso. |
| Mantener `motivo` original visible (tachado) + mostrar `voided_reason` aparte, en vez de ocultar el movimiento anulado | Ocultar movimientos anulados de la tabla | Paridad con cómo se muestran las ventas anuladas (`sales-history.dialog.ts`): transparencia de auditoría > limpieza visual. |

---

## 5. Tests

- [x] `pnpm typecheck` — pasó
- [x] `pnpm lint` — pasó (sin errores nuevos)
- [x] `pnpm test` — 350/350 pasaron

---

## 6. Bloqueos y preguntas pendientes

- (ninguno — la causa raíz del reporte original quedó identificada y resuelta dentro del alcance que el usuario priorizó)

---

## 7. Próximos pasos

1. Opcional: documentar o redefinir el tipo `correction` (hoy siempre resta, igual que `cash_out`/`expense`, pero su nombre sugiere que podría sumar — no está en RN-C03).
2. Opcional: que el selector "Tipo" del diálogo de movimiento abra vacío en vez de "Entrada de efectivo" por defecto, para forzar una selección consciente.
3. Opcional: revisar si vale la pena restringir `UPDATE`/`DELETE` directo sobre `cash_movements` por RLS (hoy solo depende de que la app llame al RPC; el patrón es el mismo que `sales`, no es deuda nueva de este módulo).

---

## 8. Notas adicionales

Usuarios involucrados en el incidente original (solo para contexto, no se tomó ninguna acción sobre las cuentas): `admin@moveonpos.co` registró ambos movimientos (`cash_out` y el `cash_in` de reversión) de la sesión `30eb1fa1…`.
