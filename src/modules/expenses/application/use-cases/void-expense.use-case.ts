import { err, ok, type Result } from '@/shared/result'
import type { Expense } from '../../domain/entities/expense.entity'
import type { ExpenseRepository } from '../../domain/repositories/expense.repository'
import { voidExpenseSchema } from '../dtos/expense.dto'
import type { ExpenseValidationError } from './register-expense.use-case'

export interface VoidExpenseDeps {
  repo: Pick<ExpenseRepository, 'voidExpense'>
  userId: string
}

/**
 * Anula un gasto con motivo auditado. Los gastos nunca se borran físicamente
 * (misma regla que ventas y movimientos de caja).
 */
export async function voidExpense(
  deps: VoidExpenseDeps,
  input: unknown,
): Promise<Result<Expense, ExpenseValidationError>> {
  const parsed = voidExpenseSchema.safeParse(input)
  if (!parsed.success) {
    return err({
      code: 'validation',
      message: parsed.error.issues[0]?.message ?? 'Datos de anulación inválidos',
    })
  }
  const expense = await deps.repo.voidExpense(parsed.data, deps.userId)
  return ok(expense)
}
