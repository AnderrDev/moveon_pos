# Spec de Sesión — 2026-06-13 — Corrección total del carrito

> Copia este archivo como `YYYY-MM-DD-<tema-kebab-case>.md` al inicio de cada sesión de trabajo.
> Llénalo durante y al final de la sesión. Es el registro de lo que pasó.

---

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-06-13 |
| Sprint | Corrección operativa POS |
| Agente | Codex |
| HUs trabajadas | M4 Pantalla de venta |
| Estado | Completada |

---

## 1. Objetivo de la sesión

Corregir el carrito del POS para que un producto con precio de venta final de $79.000 e IVA 19%
se cobre por $79.000 y no por $94.010, conservando la discriminación del IVA incluido.

---

## 2. Lo que se implementó

### 2.1 Archivos creados
- `docs/sessions/2026-06-13-correccion-total-carrito.md` — registro de la corrección.

### 2.2 Archivos modificados
- `src/modules/sales/domain/services/sale-calculator.ts` — trata `precioVenta` como precio final con IVA incluido y extrae el impuesto sin recargarlo.
- `apps/pos-angular/src/app/features/pos/pos.page.ts` — reemplaza la etiqueta `+IVA` por `IVA incluido`.
- `tests/unit/modules/sales/sale-calculator.test.ts` — actualiza expectativas y agrega regresión exacta de $79.000 al 19%.
- `tests/unit/modules/sales/create-sale-use-case.test.ts` — alinea los totales del servidor con precios finales.
- `docs/modules/sales.md` — documenta la semántica de precio final con IVA incluido.

### 2.3 Archivos eliminados
- Ninguno.

---

## 3. Decisiones tomadas

_Decisiones que no quedaron en ADR pero son relevantes para el contexto._

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| `precioVenta` representa el precio final al consumidor. | Mantenerlo como base antes de IVA. | Las cards y formularios presentan ese valor como precio de venta; sumarle IVA producía cobros superiores al precio registrado. |

---

## 4. ADRs creados o actualizados

- No se creó ADR; se corrigió una interpretación inconsistente dentro de la regla existente RN-S10.

---

## 5. Tests

- [ ] `pnpm typecheck` — `tsc --noEmit` pasó; `ng build` terminó durante `Building...` con `Abort trap: 6` sin diagnóstico.
- [x] `pnpm lint` — pasó.
- [x] `pnpm test` — 309 tests pasaron.

Detalle de fallos (si los hay): el build Angular también falló al ejecutarse con `pnpm build`, cerrándose sin mensaje de compilación.

---

## 6. Bloqueos y preguntas pendientes

_Lo que impidió avanzar o quedó sin resolver._

- [ ] Investigar por separado por qué el proceso local de Angular termina abruptamente durante el build.

---

## 7. Próximos pasos

_Qué debe hacer el próximo agente o sesión para continuar._

1. Verificar visualmente el caso real en el POS desplegado/local cuando el servidor Angular esté disponible.
2. Investigar el cierre abrupto de `ng build` si se reproduce en otra sesión.

---

## 8. Notas adicionales

El error reportado era exactamente un recargo del 19%: $79.000 se convertía en $94.010.
