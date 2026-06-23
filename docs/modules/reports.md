# Módulo: reports (Reportes)

## Responsabilidad

Lecturas agregadas para el negocio. **No tiene reglas de escritura.** Solo consultas optimizadas.

## Reportes MVP v1.0

1. Ventas del día — totales, por método, por cajero.
2. Detalle de ventas con filtros de fecha.
3. Cierre de caja imprimible con ventas esperadas/confirmadas, diferencia total y diferencia de efectivo físico.
4. Stock actual con desglose `punto_venta` / `bodega` / total y bajo stock destacado.
5. Control de descuentos: total diario, ventas afectadas, porcentaje promedio, desglose por producto/global, usuario y motivo.
6. Productos vendidos con costo, utilidad y margen (`ReportsService.getDailyReport` → `productSales` / `utilidadTotal`). Usa el costo **actual** del producto (`productos.costo`), no un snapshot histórico — `sale_items` no guarda el costo al momento de la venta. Si un producto no tiene costo capturado, sus campos de utilidad quedan en `null` (se muestra "—" en UI/Excel) y se excluye de `utilidadTotal`, nunca se asume costo 0. Limitación conocida: el margen de períodos pasados no es exacto si el costo del producto cambió desde que se vendió — aceptado como trade-off de v1 (ver `docs/sessions/2026-06-17-caja-reportes-mejoras.md`); si esto se vuelve un problema real, la solución sería una migración que agregue `sale_items.unit_cost` capturado por `create_sale_atomic`.

## Implementación

- Servicios Angular que consultan vía repositorios.
- Para reportes pesados, considerar vistas materializadas (no en MVP).
- Las vistas operativas se pueden descargar como `.xlsx` en el navegador. La exportación recibe datos ya autorizados y filtrados; no consulta tablas SQL ni expone IDs técnicos. Ver ADR 0011.
- El libro diario incluye una hoja `Descuentos` y columnas de descuento en `Ventas` y `Productos` para reconciliar el resumen con el detalle.

### Layout de `/reportes`: un componente por sección (PLAN-33)

`reportes.page.ts` es un orquestador delgado (estado, carga vía `ReportsService`, export, tabs/período). Cada bloque visual del tab "Ventas"/"Resumen contable"/"Stock" vive en su propio componente standalone `mo-*` presentacional en `apps/pos-angular/src/app/features/reports/`, sin llamadas a Supabase ni a servicios Angular — todo entra por `input.required<T>()`:

- `daily-kpi-cards.component.ts` — 5 tarjetas KPI del tab Ventas.
- `discount-control-table.component.ts` — tabla de control de descuentos.
- `payment-and-top-products.component.ts` — por método de pago (el bloque "Top productos" que vivía aquí se extrajo a `top-products-table.component.ts` en PLAN-39).
- `top-products-table.component.ts` — tabla completa (no top-5) de productos del período seleccionado, ordenable entre "Unidades" y "Facturación" (orden 100% local, sin queries nuevas). Ver sección "Top productos por periodo (PLAN-39)" más abajo.
- `cashier-breakdown-list.component.ts` — desglose por cajero.
- `cash-closures-table.component.ts` — cierres de caja del período.
- `sales-trend-tables.component.ts` — sección "Tendencia": tabla "Ventas por hora" (agregada entre todos los días del período) y "Ventas por día" del período seleccionado (PLAN-38).
- `product-sales-search.component.ts` — buscador por producto (nombre o SKU) dentro del período seleccionado: filtra `saleItems` (ya cargado, sin queries nuevas) y muestra cada movimiento de venta donde aparece (fecha, venta, cajero, cantidad, total, estado). Compuesto entre "Tendencia" y "Detalle de ventas". Estado de búsqueda (`query`) local al componente, no vive en `ReportesPage` (no afecta el resto del reporte).
- `sale-detail-list.component.ts` — detalle de ventas expandible (el bloque más grande; el estado de expansión `expandedSaleId` sigue viviendo en `ReportesPage`, se pasa como input y se emite `toggleSale` como output).
- `accounting-summary.component.ts` — tab "Resumen contable" completo (ingresos, IVA, pagos para cuadre, y compone `product-margin-table.component.ts` ya existente).
- `stock-report-table.component.ts` — tabla del tab Stock.
- `report-period.helpers.ts` — TS puro (sin Angular) con la lógica de fechas/presets (`isoDate`, `weekStart`, `monthStart`, `monthEnd`, `prevMonthStart`, `resolvePreset`). Testeado en `tests/unit/app/features/reports/report-period.helpers.test.ts` sin TestBed.

**Patrón para PLAN-38..43 (nuevas secciones de reporte):** agregar un componente nuevo siguiendo este mismo patrón (presentacional, `input.required<T>()`, sin Supabase) + una línea de composición en el template de `reportes.page.ts`. No hacer crecer un componente de sección existente ni mover lógica de orquestación/inyección de servicios fuera de `ReportesPage`.

`reports.service.ts` (384 líneas) no se tocó en este split — sigue siendo el único punto de acceso a datos del módulo; si se divide en el futuro (ventas / stock / sesiones) es un ticket aparte.

## Tendencia: ventas por hora y por día (PLAN-38)

- `ReportsService.getDailyReport` agrega dos campos a `DailyReport`: `hourlySales` (ventas completadas por hora local `0..23`, sumadas entre todos los días del período) y `dailySales` (ventas completadas por día calendario local `YYYY-MM-DD`). Se calculan en cliente sobre las mismas `sales` ya cargadas para el período — cero queries nuevas a Supabase.
- La agregación pura vive en `src/modules/reports/domain/services/sales-trend.ts` (`groupSalesByLocalHour`, `groupSalesByLocalDay`), mismo patrón que `group-sales-by-cashier.ts`: TS puro, sin Angular/Supabase, usa `Intl.DateTimeFormat` con `timeZone` explícito (la misma `timezone` ya resuelta por `TiendaInfoService` al inicio de `getDailyReport`) para bucketear por hora/día LOCAL de la tienda, nunca por hora/día UTC del runtime.
- Solo ventas `status === 'completed'` cuentan; las `voided` se excluyen por completo de ambas tablas (no generan fila ni aportan a los totales) — consistente con `countAnuladas`, que ya se reporta aparte en las tarjetas KPI.
- **Decisión explícita: NO se rellenan horas/días sin ventas.** Solo se emite una fila por hora/día con al menos una venta completada. Rellenar las 24 horas (o cada día del rango) no aporta valor a un reporte tabular de "qué pasó" y forzaría a depender de `addDays`/`isoDate` de `report-period.helpers.ts` (capa Angular-feature) desde el dominio, rompiendo el layering. `report-period.helpers.ts` sigue siendo solo para el selector de período (presets), no para padding de tendencia.
- UI: `sales-trend-tables.component.ts`, sección "Tendencia" en el tab "Ventas", compuesta entre "Cierres de caja" y "Detalle de ventas".

## Top productos por periodo (PLAN-39)

- `ReportsService.getDailyReport` agrega dos campos a `DailyProductSale`: `numVentas` (cantidad de ventas DISTINTAS en las que aparece el producto, no cantidad de líneas) y `avgPrice` (precio promedio simple de `unitPrice` entre líneas, NO `total / qty`). Replica exactamente la semántica de la sección 4 ("PRODUCTOS MÁS VENDIDOS") de `scripts/reports/business-status-report.sql`: solo `status = 'completed'`, `numVentas` = `count(distinct si.sale_id)`, `avgPrice` = `round(avg(si.unit_price), 2)`.
- La agregación pura vive en `src/modules/reports/domain/services/top-products.ts` (`groupSalesByProduct`), mismo patrón que `group-sales-by-cashier.ts`/`sales-trend.ts`: TS puro, sin Angular/Supabase, usa `Set<saleId>` por producto para contar ventas distintas. Se calcula en cliente sobre las mismas `sales` ya cargadas para el período — cero queries nuevas a Supabase.
- El enriquecimiento de costo/utilidad/margen (`costoUnitario`, `costoTotal`, `utilidad`, `margenPct`) sigue resolviéndose en `reports.service.ts` después de llamar a `groupSalesByProduct`, porque depende de `products.costo` (fuente externa al dominio puro de ventas) — no se movió al servicio de dominio nuevo.
- UI: `top-products-table.component.ts` reemplaza el bloque "Top productos" de 5 filas que vivía en `payment-and-top-products.component.ts`. Muestra **todos** los productos del período (no solo top 5), con un toggle "Unidades"/"Facturación" que reordena en cliente vía un `signal` local — no dispara ninguna petición de red. Compuesto en el tab "Ventas" justo después de "Por método de pago" y antes de "Desglose por cajero".

## Zona horaria del reporte diario (PLAN-01)

- El reporte diario filtra ventas y sesiones por el **día calendario en la zona horaria de la tienda**, no por el día UTC. Una venta a las 23:30 hora Colombia pertenece a ESE día local.
- La TZ es configurable por tienda en `tiendas.timezone` (`text not null default 'America/Bogota'`, multi-sede). Migración: `supabase/migrations/20260527_001_add_tienda_timezone.sql`.
- El cálculo del rango UTC `[start, end)` (semiabierto) vive en el dominio puro: `src/modules/reports/domain/services/day-range.ts` → `getStoreDayRangeUtc(dateIso, timezone)` y `DEFAULT_TIMEZONE`. Deriva el offset vía `Intl` (sin hardcodear −5 ni `setHours`).
- `ReportsService.getDailyReport(tiendaId, dateIso)` resuelve la TZ vía `TiendaInfoService` (fallback `DEFAULT_TIMEZONE`) y pasa el rango a `SalesRepository.listByDate(tiendaId, start, end)` (usa `.gte(start)` + `.lt(end)`, no `.lte 23:59:59.999`) y a `CashRegisterRepository.listSessionsByDateRange`.
- `reportes.page.ts` `todayIso(timezone)` usa `Intl.DateTimeFormat('en-CA', { timeZone })` para "hoy" en la TZ de la tienda, no la del navegador.
- `created_at` se sigue guardando en UTC (timestamptz); no cambia la escritura.

## Reportes post-MVP (v1.4)

- Comparativos por día/semana/mes.
- Productos próximos a quedar sin stock por velocidad de venta.
- Margen con costo histórico (snapshot al momento de la venta), si el costo actual (ver punto 6 arriba) resulta insuficiente en la práctica.

## Stock por ubicación (PLAN-23..26)

- El reporte de stock muestra `punto_venta`, `bodega` y total.
- "Stock bajo" se calcula contra `punto_venta`, porque es el stock vendible.
- Productos `prepared` siguen excluidos de bajo stock.
