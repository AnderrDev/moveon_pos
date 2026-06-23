# Spec de Sesión — 2026-06-23 — Detalle de ventas en Caja

> Copia este archivo como `YYYY-MM-DD-<tema-kebab-case>.md` al inicio de cada sesión de trabajo.
> Llénalo durante y al final de la sesión. Es el registro de lo que pasó.

---

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-06-23 |
| Sprint | N/A |
| Agente | Claude Code |
| HUs trabajadas | N/A (mejora UX solicitada directamente) |
| Estado | En progreso |

---

## 1. Objetivo de la sesión

El usuario reportó que en la sección de Caja, la tabla "Ventas del turno" solo muestra un resumen
(hora, # venta, cajero, método, total, estado) pero no el detalle de cada venta (productos,
descuentos, pagos, registro). Se pidió agregar ese detalle para tener todo el contexto sin salir
de Caja.

---

## 2. Lo que se implementó

### 2.1 Archivos creados
- `apps/pos-angular/src/app/features/sales/sale-detail.component.ts` — componente presentacional
  `mo-sale-detail` que renderiza productos vendidos, resumen de totales, pagos recibidos y registro
  de una venta. Extraído de `sales-history.dialog.ts` para reutilizarlo también en Caja.

### 2.2 Archivos modificados
- `apps/pos-angular/src/app/features/pos/sales-history.dialog.ts` — usa `mo-sale-detail` en vez de
  duplicar el markup de detalle.
- `apps/pos-angular/src/app/features/cash-register/turn-sales-table.component.ts` — filas
  expandibles (igual patrón que el historial de ventas del POS) que muestran `mo-sale-detail` al
  hacer click.

---

## 3. Decisiones tomadas

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| Extraer `SaleDetailComponent` a `features/sales/` (no a `shared/`) | Ponerlo en `shared/ui/` | El estándar de componentes UI dice que lo muy específico del negocio no va en `shared/`; `features/sales` ya es el módulo cruzado que usan `pos` y `cash-register` (ej. `SalesRepository`) |
| No incluir acciones (anular venta, reimprimir, corregir pago) en la tabla de Caja | Replicar todas las acciones del dialog de POS | El pedido era solo visibilidad/contexto; agregar acciones es una ampliación de alcance que se evalúa aparte |

---

## 5. Tests

- [x] `pnpm typecheck` — pasó
- [x] `pnpm lint` — sin errores nuevos (8 errores preexistentes en otros archivos no tocados)
- [x] `pnpm test` — 347 pasaron, 3 fallaron por timezone del contenedor (`formatTime` espera offset
      `-05:00`, preexistente en `main`, no relacionado con este cambio — verificado con `git stash`)

---

## 6. Bloqueos y preguntas pendientes

- [ ] ¿Se quiere que la tabla de Caja también permita anular venta / reimprimir tirilla desde ahí, o se mantiene solo lectura?

---

## 7. Próximos pasos

1. Validar con el usuario si se necesitan acciones (anular/reimprimir) en la vista de Caja.

---

## 8. Notas adicionales

N/A
