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
 * Contrato de persistencia del módulo de finanzas.
 * La implementación vive en la capa Angular
 * (`apps/pos-angular/src/app/features/expenses/expenses.repository.ts`)
 * y nunca expone tipos de Supabase al dominio.
 */
export interface ExpenseRepository {
  listCategories(tiendaId: string): Promise<ExpenseCategory[]>
  /** Gastos con `fecha_gasto` dentro de `[fromDate, toDate]` (`YYYY-MM-DD`, inclusive). */
  listExpenses(tiendaId: string, fromDate: string, toDate: string): Promise<Expense[]>
  createExpense(dto: CreateExpenseDto, userId: string): Promise<Expense>
  voidExpense(dto: VoidExpenseDto, userId: string): Promise<Expense>

  listEmpleados(tiendaId: string): Promise<Empleado[]>
  saveEmpleado(dto: SaveEmpleadoDto): Promise<Empleado>

  listTemplates(tiendaId: string): Promise<ExpenseTemplate[]>
  saveTemplate(dto: SaveTemplateDto): Promise<ExpenseTemplate>
  /** Las plantillas son configuración (no registros transaccionales): borrado físico permitido. */
  deleteTemplate(id: string, tiendaId: string): Promise<void>

  /** `null` cuando la tienda aún no configuró el fondo de reinversión. */
  getFundSettings(tiendaId: string): Promise<ReinvestmentFundSettings | null>
  saveFundSettings(dto: SaveFundSettingsDto): Promise<ReinvestmentFundSettings>
  /**
   * Totales del fondo desde `desdeIso` (fecha de inicio del fondo) más el
   * desglose del mes visible `[mesDesdeIso, mesHastaIso)` — fin exclusivo.
   */
  getFundTotals(
    tiendaId: string,
    desdeIso: string,
    mesDesdeIso: string,
    mesHastaIso: string,
  ): Promise<ReinvestmentFundTotals>
}
