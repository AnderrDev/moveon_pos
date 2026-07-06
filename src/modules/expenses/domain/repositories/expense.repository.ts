import type {
  Empleado,
  Expense,
  ExpenseCategory,
  ExpenseTemplate,
} from '../entities/expense.entity'
import type { CreateExpenseDto, VoidExpenseDto } from '../../application/dtos/expense.dto'
import type { SaveEmpleadoDto } from '../../application/dtos/empleado.dto'
import type { SaveTemplateDto } from '../../application/dtos/template.dto'

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
}
