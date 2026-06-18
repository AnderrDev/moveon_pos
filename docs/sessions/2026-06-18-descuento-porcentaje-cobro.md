# Spec de Sesión — 2026-06-18 — Descuento por porcentaje en cobro

---

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-06-18 |
| Sprint | Sprint 4 |
| Agente | Claude Code |
| HUs trabajadas | (sin HU formal, mejora directa al flujo de cobro reportada por el usuario) |
| Estado | Completada |

---

## 1. Objetivo de la sesión

El modal de cobro del POS ya tiene un descuento global en monto fijo (pesos). El usuario quiere poder aplicar también un descuento por **porcentaje**, sin perder la opción de monto fijo existente.

---

## 2. Lo que se implementó

### 2.1 Archivos creados
- (ninguno)

### 2.2 Archivos modificados
- `apps/pos-angular/src/app/features/pos/pos.page.ts` — en la sección "Descuento global" del modal de cobro se agregó un toggle `$` / `%` (mismo patrón visual que el toggle "Imprimir/No imprimir" ya existente, vía `discountModeClass()`). En modo `%` el cajero escribe un porcentaje entero (0-100) sobre el subtotal; se convierte a pesos (`Math.round(subtotal * percent / 100)`) y se envía al store con el mismo `cart.setGlobalDiscount()` que ya existía — no se tocó el dominio. Nuevas señales: `discountMode`, `globalDiscountPercentInput`. Nuevos métodos: `setGlobalDiscountPercent()`, `setDiscountMode()`, `discountModeClass()`. Se actualizaron `openCheckout()`, `clearGlobalDiscount()` y el reset post-venta en `confirmSale()` para resetear también el modo/input de porcentaje.

### 2.3 Archivos eliminados
- (ninguno)

---

## 3. Decisiones tomadas

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| Calcular el % sobre `cart.totals().subtotal` (suma bruta antes de descuentos por ítem) | Calcular sobre el total post-descuentos de ítem | Es la misma base que ya usan `discountPercentage()` (display) y `validateDiscountAuthorization()` (regla del 10% admin) — mantiene el porcentaje mostrado consistente con el porcentaje ingresado |
| No tocar el dominio (`calculateCartTotals`, DTOs, Zod) | Agregar un concepto de "descuento por porcentaje" en el dominio | El store solo necesita un monto en pesos; el porcentaje es puramente un modo de entrada en la UI, se convierte antes de llegar al store. Menos superficie de cambio, reutiliza toda la lógica de distribución de IVA ya probada |
| Reusar el patrón de toggle de botones (`aria-pressed` + clase activa/inactiva) ya usado en "Imprimir/No imprimir" | Usar un `<select>` o radio buttons | Consistencia visual con el resto del modal de cobro en este mismo componente |

---

## 4. ADRs creados o actualizados

---

## 5. Tests

- [x] `pnpm typecheck` — pasó
- [x] `pnpm lint` — pasó (mismos 8 errores/3 warnings preexistentes en otros módulos, no relacionados)
- [x] `pnpm test` — 347 tests pasaron, 0 fallaron

Verificación manual en navegador (`pnpm dev`, login con credenciales de prueba `cajero@moveonpos.co`, entorno prod pero **sin confirmar ninguna venta**):
- Toggle `$`/`%` se renderiza correctamente en el modal de cobro.
- Al escribir `10` en modo `%` sobre un producto de $1.500: descuento calculado = $150 (10.00%), total venta recalculado a $1.350 — coincide con el panel "Control del descuento" ya existente.
- Al volver a modo `$`, el input refleja el monto convertido (150).
- "Quitar" limpia ambos modos y vuelve el total a $1.500.
- Métodos de pago visibles: Efectivo, Tarjeta, Transferencia (confirma también que la unificación de la sesión anterior sigue vigente).
- Se cerró el modal con "Cancelar" sin tocar "Confirmar" — no se creó ninguna venta real.

---

## 6. Bloqueos y preguntas pendientes

---

## 7. Próximos pasos

---

## 8. Notas adicionales
