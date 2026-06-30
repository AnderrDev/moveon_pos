# Spec de Sesión — 2026-06-30 — Indicador "Agotado" en Productos e Inventario

---

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-06-30 |
| Sprint | N/A (mejora puntual de UI) |
| Agente | Claude Code |
| HUs trabajadas | Ninguna formal — solicitud directa del usuario |
| Estado | Completada |

---

## 1. Objetivo de la sesión

El usuario pidió que en los listados de **Productos** e **Inventario** se marquen visualmente (en rojo) los productos sin stock disponible en punto de venta. Ese indicador ya existía en la pantalla de venta (`pos.page.ts`: badge "Agotado", tarjeta atenuada, ordenado al final) pero faltaba en las tablas de Productos, Inventario y el reporte de Stock, donde un producto con stock 0 se veía igual que uno en "Stock bajo" (badge ámbar).

---

## 2. Lo que se implementó

### 2.1 Archivos creados
- Ninguno.

### 2.2 Archivos modificados
- `src/modules/inventory/domain/services/low-stock.ts` — nueva función de dominio pura `isOutOfStock({ tipo, currentStock })`, hermana de `isLowStock`, con la misma exclusión de productos `prepared` (no llevan stock propio).
- `tests/unit/modules/inventory/low-stock.test.ts` — tests para `isOutOfStock` (preparado nunca agotado, simple/ingredient agotados con stock ≤ 0).
- `apps/pos-angular/src/app/features/inventory/inventario.page.ts` — `StockRow.isOut`; fila resaltada en rojo (`bg-red-50`) cuando está agotado (en vez de ámbar); badge `destructive` "Agotado" con prioridad sobre "Stock bajo"; celda de stock en punto de venta en rojo.
- `apps/pos-angular/src/app/features/inventory/inventory-export.ts` — `InventoryExportRow.isOut`; columna "Estado" del Excel distingue "Agotado" de "Stock bajo".
- `apps/pos-angular/src/app/features/products/productos.page.ts` — método `isOut(product)` (usa `stockMap()` + `isOutOfStock`); fila y celda de stock en rojo; badge `destructive` "Agotado" junto al de "Inactivo".
- `apps/pos-angular/src/app/features/reports/reports.service.ts` — `StockReportRow.isOut`; cálculo en `getStockReport`; orden de la tabla prioriza agotados, luego bajo stock, luego alfabético.
- `apps/pos-angular/src/app/features/reports/stock-report-table.component.ts` — misma UI (fila roja, badge "Agotado") en la tabla del tab "Stock" del reporte.
- `apps/pos-angular/src/app/features/reports/report-export.ts` — columna "Estado" del Excel de reporte de stock distingue "Agotado".

### 2.3 Archivos eliminados
- Ninguno.

---

## 3. Decisiones tomadas

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| Reutilizar `mo-badge variant="destructive"` (ya mapeado a rojo) para "Agotado" | Crear un componente de badge nuevo | El estándar de UI exige reusar componentes existentes; `BadgeComponent` ya soporta la variante `destructive`. |
| Crear `isOutOfStock` como función de dominio pura junto a `isLowStock` | Calcular `stock === 0` inline en cada página | Mantiene una única fuente de verdad de la regla de negocio (incluida la exclusión de `prepared`), igual que ya se hace con `isLowStock`. |
| "Agotado" (rojo) tiene prioridad visual sobre "Stock bajo" (ámbar) cuando ambos aplican | Mostrar ambos badges simultáneamente | Un producto agotado siempre cumple también la condición de bajo stock; mostrar solo "Agotado" evita redundancia y es más claro para el operador. |

---

## 4. ADRs creados o actualizados

- Ninguno — cambio de UI que reutiliza patrones y componentes ya existentes (mismo criterio que `pos.page.ts`), no introduce decisión arquitectónica nueva.

---

## 5. Tests

- [x] `pnpm typecheck` — pasó
- [x] `pnpm lint` — pasó (sin errores nuevos; los 7 errores/6 warnings preexistentes en otros archivos no relacionados con esta tarea se mantienen igual)
- [x] `pnpm test` — 403 tests pasaron, 3 fallaron (preexistentes, `tests/unit/shared/lib/format.test.ts`, dependientes de la zona horaria del entorno de ejecución — verificado que fallan igual en `main` antes de este cambio)

---

## 6. Bloqueos y preguntas pendientes

Ninguno.

---

## 7. Próximos pasos

1. Si se desea, extender el mismo indicador "Agotado" al catálogo público (`features/catalog/catalogo.page.ts`), que actualmente no muestra estado de stock.
2. Considerar extraer `isOutOfStock`/`isLowStock` a un único "estado de stock" (`'out' | 'low' | 'ok'`) si se agregan más estados visuales en el futuro, para evitar duplicar el `if/else` de prioridad en cada componente.

---

## 8. Notas adicionales

El patrón de referencia para "Agotado" ya existía en `apps/pos-angular/src/app/features/pos/pos.page.ts` (badge, tarjeta atenuada, orden al final de la grilla). Esta sesión extiende esa misma regla de negocio (vía la nueva función de dominio `isOutOfStock`) a las vistas de gestión (Productos, Inventario, Reporte de Stock) que antes no la tenían.
