import type { CreateExpenseDto } from '@angular-app/features/expenses/domain/dtos/expense.dto'
import type { ExpenseFormValue } from '@angular-app/features/expenses/presentation/forms/expense-form.factory'

export interface ExpenseFormContext {
  tiendaId: string
  /** Presente solo cuando el gasto es un pago de nómina. */
  empleadoId?: string
  /** `YYYY-MM` o `YYYY-MM-Q1`/`YYYY-MM-Q2` para nómina y recurrentes. */
  periodo?: string
}

export const expenseFormMapper = {
  toCreateDto(value: ExpenseFormValue, ctx: ExpenseFormContext): CreateExpenseDto {
    return {
      tiendaId: ctx.tiendaId,
      categoryId: value.categoryId,
      empleadoId: ctx.empleadoId,
      concepto: value.concepto.trim(),
      notas: value.notas?.trim() ? value.notas.trim() : undefined,
      monto: value.monto,
      fechaGasto: value.fechaGasto,
      metodoPago: value.metodoPago,
      periodo: ctx.periodo,
    }
  },
}
