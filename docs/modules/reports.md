# Módulo: reports (Reportes)

## Responsabilidad
Lecturas agregadas para el negocio. **No tiene reglas de escritura.** Solo consultas optimizadas.

## Reportes MVP v1.0
1. Ventas del día — totales, por método, por cajero.
2. Detalle de ventas con filtros de fecha.
3. Cierre de caja imprimible con ventas esperadas/confirmadas, diferencia total y diferencia de efectivo físico.
4. Stock actual con desglose `punto_venta` / `bodega` / total y bajo stock destacado.

## Implementación
- Servicios Angular que consultan vía repositorios.
- Para reportes pesados, considerar vistas materializadas (no en MVP).

## Zona horaria del reporte diario (PLAN-01)
- El reporte diario filtra ventas y sesiones por el **día calendario en la zona horaria de la tienda**, no por el día UTC. Una venta a las 23:30 hora Colombia pertenece a ESE día local.
- La TZ es configurable por tienda en `tiendas.timezone` (`text not null default 'America/Bogota'`, multi-sede). Migración: `supabase/migrations/20260527_001_add_tienda_timezone.sql`.
- El cálculo del rango UTC `[start, end)` (semiabierto) vive en el dominio puro: `src/modules/reports/domain/services/day-range.ts` → `getStoreDayRangeUtc(dateIso, timezone)` y `DEFAULT_TIMEZONE`. Deriva el offset vía `Intl` (sin hardcodear −5 ni `setHours`).
- `ReportsService.getDailyReport(tiendaId, dateIso)` resuelve la TZ vía `TiendaInfoService` (fallback `DEFAULT_TIMEZONE`) y pasa el rango a `SalesRepository.listByDate(tiendaId, start, end)` (usa `.gte(start)` + `.lt(end)`, no `.lte 23:59:59.999`) y a `CashRegisterRepository.listSessionsByDateRange`.
- `reportes.page.ts` `todayIso(timezone)` usa `Intl.DateTimeFormat('en-CA', { timeZone })` para "hoy" en la TZ de la tienda, no la del navegador.
- `created_at` se sigue guardando en UTC (timestamptz); no cambia la escritura.

## Reportes post-MVP (v1.4)
- Margen y utilidad por producto.
- Top productos / batidos.
- Comparativos por día/semana/mes.
- Productos próximos a quedar sin stock por velocidad de venta.

## Stock por ubicación (PLAN-23..26)
- El reporte de stock muestra `punto_venta`, `bodega` y total.
- "Stock bajo" se calcula contra `punto_venta`, porque es el stock vendible.
- Productos `prepared` siguen excluidos de bajo stock.
