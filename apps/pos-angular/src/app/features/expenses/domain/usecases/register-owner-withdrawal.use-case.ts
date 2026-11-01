import { err, ok, type Result } from '@/shared/result'
import type { OwnerWithdrawal } from '@angular-app/features/expenses/domain/entities/expense.entity'
import type { ExpenseRepository } from '@angular-app/features/expenses/domain/repositories/expense.repository'
import { registerOwnerWithdrawalSchema } from '@angular-app/features/expenses/domain/dtos/owner-withdrawal.dto'
import type { ExpenseValidationError } from '@angular-app/features/expenses/domain/usecases/register-expense.use-case'

export interface RegisterOwnerWithdrawalDeps {
  repo: Pick<ExpenseRepository, 'createOwnerWithdrawal'>
}

/**
 * Registra un retiro del dueño (ADR 0025 §3): plata que sale del sobre de
 * utilidad. No es un gasto. Errores de forma como `Result`; fallos técnicos
 * del repositorio como `throw`.
 */
export async function registerOwnerWithdrawal(
  deps: RegisterOwnerWithdrawalDeps,
  input: unknown,
): Promise<Result<OwnerWithdrawal, ExpenseValidationError>> {
  const parsed = registerOwnerWithdrawalSchema.safeParse(input)
  if (!parsed.success) {
    return err({
      code: 'validation',
      message: parsed.error.issues[0]?.message ?? 'Datos del retiro inválidos',
    })
  }
  return ok(await deps.repo.createOwnerWithdrawal(parsed.data))
}
