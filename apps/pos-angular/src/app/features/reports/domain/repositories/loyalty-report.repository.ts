import type { LoyaltyProgramReport } from '@angular-app/features/loyalty/domain/services/program-report'

/**
 * Contrato de lectura del reporte del programa MOVE ON Club para /reportes.
 * Abstract class (ADR 0015 §6.1). No existía interfaz previa — creado desde
 * el uso real de `LoyaltyReportService` (PLAN-66).
 */
export abstract class LoyaltyReportRepository {
  /** KPIs del período `[fromIso, toIso]` (días locales inclusivos) en la zona horaria de la tienda. */
  abstract getReport(tiendaId: string, fromIso: string, toIso: string): Promise<LoyaltyProgramReport>
}
