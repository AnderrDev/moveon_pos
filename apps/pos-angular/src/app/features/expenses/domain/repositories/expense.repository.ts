import type {
  Empleado,
  Expense,
  ExpenseCategory,
  ExpenseTemplate,
  ReinvestmentFundSettings,
} from '@angular-app/features/expenses/domain/entities/expense.entity'
import type { ReinvestmentFundTotals } from '@angular-app/features/expenses/domain/services/reinvestment-fund'
import type { CreateExpenseDto, VoidExpenseDto } from '@angular-app/features/expenses/domain/dtos/expense.dto'
import type { SaveEmpleadoDto } from '@angular-app/features/expenses/domain/dtos/empleado.dto'
import type { SaveFundSettingsDto } from '@angular-app/features/expenses/domain/dtos/fund-settings.dto'
import type { SaveTemplateDto } from '@angular-app/features/expenses/domain/dtos/template.dto'

/**
 * Contrato de persistencia del módulo de finanzas. Abstract class
 * (ADR 0015 §6.1): TS puro, cero Angular, sirve como token de DI.
 * La implementación vive en
 * `apps/pos-angular/src/app/features/expenses/data/repositories/expenses.repository.ts`
 * y nunca expone tipos de Supabase al dominio.
 */
export abstract class ExpenseRepository {
  abstract listCategories(tiendaId: string): Promise<ExpenseCategory[]>
  /** Gastos con `fecha_gasto` dentro de `[fromDate, toDate]` (`YYYY-MM-DD`, inclusive). */
  abstract listExpenses(tiendaId: string, fromDate: string, toDate: string): Promise<Expense[]>
  abstract createExpense(dto: CreateExpenseDto, userId: string): Promise<Expense>
  abstract voidExpense(dto: VoidExpenseDto, userId: string): Promise<Expense>

  abstract listEmpleados(tiendaId: string): Promise<Empleado[]>
  abstract saveEmpleado(dto: SaveEmpleadoDto): Promise<Empleado>

  abstract listTemplates(tiendaId: string): Promise<ExpenseTemplate[]>
  abstract saveTemplate(dto: SaveTemplateDto): Promise<ExpenseTemplate>
  /** Las plantillas son configuración (no registros transaccionales): borrado físico permitido. */
  abstract deleteTemplate(id: string, tiendaId: string): Promise<void>

  /** `null` cuando la tienda aún no configuró el fondo de reinversión. */
  abstract getFundSettings(tiendaId: string): Promise<ReinvestmentFundSettings | null>
  abstract saveFundSettings(dto: SaveFundSettingsDto): Promise<ReinvestmentFundSettings>
  /**
   * Totales del fondo desde `desdeIso` (fecha de inicio del fondo) más el
   * desglose del mes visible `[mesDesdeIso, mesHastaIso)` — fin exclusivo.
   */
  abstract getFundTotals(
    tiendaId: string,
    desdeIso: string,
    mesDesdeIso: string,
    mesHastaIso: string,
  ): Promise<ReinvestmentFundTotals>
  /**
   * Totales mensuales agregados en el servidor para la comparativa (nunca
   * filas crudas: el cliente truncaba en el límite de 1000 filas de
   * PostgREST — bug 2026-07-21).
   */
  abstract getMonthlySalesTotals(
    tiendaId: string,
    fromIso: string,
  ): Promise<{ month: string; total: number }[]>
  abstract getMonthlyExpenseTotals(
    tiendaId: string,
    fromDate: string,
  ): Promise<{ month: string; total: number }[]>
}
