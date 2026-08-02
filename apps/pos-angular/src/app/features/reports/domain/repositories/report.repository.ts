import type { DailyReport, StockReportRow } from '@angular-app/features/reports/domain/entities/report.entity'

/**
 * Contrato de lectura de los reportes de ventas/contabilidad/stock. Abstract
 * class (ADR 0015 §6.1). No existía interfaz previa — creado desde el uso
 * real de `ReportsService` (PLAN-66). Solo lecturas: el reporte agrega datos
 * de otras features (`sales`, `cash-register`, `inventory`, `products`), no
 * escribe nada propio.
 */
export abstract class ReportRepository {
  /**
   * Reporte del período `[fromIso, toIso]` (ambos días inclusivos) en la zona
   * horaria de la tienda. Si `toIso` se omite, se asume el mismo día que `fromIso`.
   */
  abstract getDailyReport(tiendaId: string, fromIso: string, toIso?: string): Promise<DailyReport>
  abstract getStockReport(tiendaId: string): Promise<StockReportRow[]>
}
