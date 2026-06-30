# Spec de Sesión — 2026-06-30 — Restringir métodos de pago a Efectivo/Transferencia

---

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-06-30 |
| Sprint | N/A (ajuste de regla de negocio) |
| Agente | Claude Code |
| HUs trabajadas | Ninguna formal — solicitud directa del usuario |
| Estado | Completada |

---

## 1. Objetivo de la sesión

El usuario indicó que el negocio solo acepta 2 métodos de pago: **Efectivo** y **Transferencia**. El sistema soportaba 4 (`cash`, `card`, `transfer`, `other`) en todos los selectores (modal de pago en POS, corrección de pago, cierre de caja, filtros de ventas del turno agregados en la sesión anterior).

Se preguntó al usuario el alcance: ocultar `card`/`other` solo de los selectores de UI, o eliminarlos también de la base de datos (migración tipo la de `20260617_002_unify_transfer_payment_method.sql`, que ya unificó nequi/daviplata en transfer). El usuario eligió **solo ocultar de los selectores**, sin tocar el tipo `PaymentMethod` ni el enum de Postgres — así cualquier dato histórico con `card`/`other` se sigue mostrando correctamente.

---

## 2. Lo que se implementó

### 2.1 Archivos creados
- Ninguno.

### 2.2 Archivos modificados
- `src/shared/lib/payment-methods.ts` — `PAYMENT_METHOD_OPTIONS` ahora solo `cash`/`transfer`; `PAYMENT_METHOD_CLOSURE_OPTIONS` es un alias del mismo array (ya no agrega `other`). `PAYMENT_METHOD_LABELS` conserva las 4 etiquetas (incluye `card`/`other`) para que `getPaymentMethodLabel` siga mostrando correctamente datos históricos.
- `apps/pos-angular/src/app/features/pos/correct-payment.dialog.ts` — elimina su lista local `PAYMENT_METHOD_OPTIONS` (que se construía con las 4 labels) y usa la constante compartida (ahora 2 opciones), evitando una fuente de verdad duplicada.
- `apps/pos-angular/src/app/features/cash-register/close-session.dialog.ts` — `NON_CASH_METHODS` pasa de `[card, transfer, other]` a solo `[transfer]`; se eliminan los `FormControl` `actualCardAmount`/`actualOtherAmount` (ya no hay fila de conteo para esos métodos en el diálogo de cierre) y el payload `actualPayments` enviado al RPC `close_cash_session_atomic` ya no incluye esas entradas (el RPC itera un `jsonb` genérico, así que omitirlas es seguro).
- `tests/unit/shared/lib/payment-methods.test.ts` — actualiza las expectativas de `PAYMENT_METHOD_OPTIONS`/`PAYMENT_METHOD_CLOSURE_OPTIONS` a `['cash', 'transfer']` y agrega un test que confirma que `getPaymentMethodLabel('card'|'other')` sigue devolviendo su label (compatibilidad histórica).
- `docs/modules/cash-register.md` — RN-C06 actualizada: el negocio solo confirma `cash`/`transfer` al cerrar caja.
- `docs/modules/sales.md` — nota junto al tipo `Payment` aclarando que solo `cash`/`transfer` se ofrecen en UI.

### 2.3 Archivos eliminados
- Ninguno.

---

## 3. Decisiones tomadas

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| Ocultar `card`/`other` solo de los selectores de UI (`PAYMENT_METHOD_OPTIONS`), sin tocar el tipo `PaymentMethod` ni el enum de Postgres | Migración SQL para eliminar `card`/`other` del enum `payment_method` (como se hizo con nequi/daviplata) | Elegido explícitamente por el usuario: cambio más simple y reversible; no arriesga romper ventas históricas que pudieran tener esos métodos, y evita una migración de BD para una decisión de negocio que podría volver a cambiar. |
| `PAYMENT_METHOD_CLOSURE_OPTIONS` queda como alias de `PAYMENT_METHOD_OPTIONS` en vez de eliminarse | Eliminar `PAYMENT_METHOD_CLOSURE_OPTIONS` y que cada sitio importe `PAYMENT_METHOD_OPTIONS` directamente | Minimiza el diff: 3 archivos (`sales-history.dialog.ts`, `caja.page.ts`, `reportes.page.ts`) ya importan ese nombre específico para los filtros agregados en la sesión anterior; renombrar todos los call sites no aportaba valor. |
| `correct-payment.dialog.ts` reutiliza la constante compartida en vez de mantener su propia lista derivada de `PAYMENT_METHOD_LABELS` | Dejar la lista local y solo recortarla a mano | Una sola fuente de verdad evita que un futuro cambio de métodos de pago olvide actualizar este archivo (ya había duplicación antes de este cambio). |

---

## 4. ADRs creados o actualizados

- Ninguno — ajuste de configuración/datos de UI, no decisión arquitectónica.

---

## 5. Tests

- [x] `pnpm typecheck` — pasó
- [x] `pnpm lint` — pasó (sin errores nuevos en los archivos modificados; persisten errores preexistentes no relacionados en otros archivos)
- [x] `pnpm test` — 404 tests pasaron, 3 fallaron (preexistentes, `tests/unit/shared/lib/format.test.ts`, dependientes de zona horaria del entorno, no relacionados con este cambio)

---

## 6. Bloqueos y preguntas pendientes

Ninguno.

---

## 7. Próximos pasos

1. Si en algún momento se confirma que no hay (ni habrá) datos históricos con `card`/`other`, se puede hacer la migración SQL para reducir el enum `payment_method` a `('cash', 'transfer')`, siguiendo el patrón de `20260617_002_unify_transfer_payment_method.sql`.
2. Si el negocio vuelve a aceptar tarjeta en el futuro, basta con agregar la entrada de vuelta en `PAYMENT_METHOD_OPTIONS` y en `NON_CASH_METHODS` (`close-session.dialog.ts`) — no requiere migración porque el tipo/enum nunca se redujo.

---

## 8. Notas adicionales

Los bloques que muestran totales por método (breakdown de caja, KPIs de reportes, exports a Excel) son data-driven: leen directamente los pagos registrados en las ventas, no una lista fija de métodos. Por eso no necesitaron cambios — si alguna vez aparece un pago histórico en `card`/`other`, esos bloques lo seguirán mostrando con su label correcto sin filtrarlo.
