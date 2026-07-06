import { err, ok, type Result } from '@/shared/result'
import type { Expense } from '../../domain/entities/expense.entity'
import type { ExpenseRepository } from '../../domain/repositories/expense.repository'
import { createExpenseSchema } from '../dtos/expense.dto'

export interface RegisterExpenseDeps {
  repo: Pick<ExpenseRepository, 'createExpense'>
  userId: string
}

export interface ExpenseValidationError {
  code: 'validation'
  message: string
}

/**
 * Valida y registra un gasto del negocio. Errores de dominio como `Result`;
 * los fallos técnicos (red, DB) del repositorio se propagan como `throw`.
 */
export async function registerExpense(
  deps: RegisterExpenseDeps,
  input: unknown,
): Promise<Result<Expense, ExpenseValidationError>> {
  const parsed = createExpenseSchema.safeParse(input)
  if (!parsed.success) {
    return err({
      code: 'validation',
      message: parsed.error.issues[0]?.message ?? 'Datos del gasto inválidos',
    })
  }
  const expense = await deps.repo.createExpense(parsed.data, deps.userId)
  return ok(expense)
}
