import { err, ok, type Result } from '@/shared/result'
import type { OwnerWithdrawal } from '@angular-app/features/expenses/domain/entities/expense.entity'
import type { ExpenseRepository } from '@angular-app/features/expenses/domain/repositories/expense.repository'
import { voidOwnerWithdrawalSchema } from '@angular-app/features/expenses/domain/dtos/owner-withdrawal.dto'
import type { ExpenseValidationError } from '@angular-app/features/expenses/domain/usecases/register-expense.use-case'

export interface VoidOwnerWithdrawalDeps {
  repo: Pick<ExpenseRepository, 'voidOwnerWithdrawal'>
}

/** Anula un retiro con motivo auditado; si salió de caja, la salida también se anula (RPC). */
export async function voidOwnerWithdrawal(
  deps: VoidOwnerWithdrawalDeps,
  input: unknown,
): Promise<Result<OwnerWithdrawal, ExpenseValidationError>> {
  const parsed = voidOwnerWithdrawalSchema.safeParse(input)
  if (!parsed.success) {
    return err({
      code: 'validation',
      message: parsed.error.issues[0]?.message ?? 'Datos de anulación inválidos',
    })
  }
  return ok(await deps.repo.voidOwnerWithdrawal(parsed.data))
}
