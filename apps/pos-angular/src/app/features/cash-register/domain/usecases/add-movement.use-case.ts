import { err, ok, type Result } from '@/shared/result'
import type { CashMovement } from '@angular-app/features/cash-register/domain/entities/cash-session.entity'
import type { CashRegisterRepository } from '@angular-app/features/cash-register/domain/repositories/cash-register.repository'
import { addMovementSchema } from '@angular-app/features/cash-register/domain/dtos/cash-register.dto'
import type { CashRegisterValidationError } from '@angular-app/features/cash-register/domain/usecases/open-session.use-case'

export interface AddCashMovementDeps {
  repo: Pick<CashRegisterRepository, 'addMovement'>
  cashSessionId: string
  createdBy: string
}

/** Valida y registra un movimiento de caja. Mismo contrato de errores que `openCashSession`. */
export async function addCashMovement(
  deps: AddCashMovementDeps,
  input: unknown,
): Promise<Result<CashMovement, CashRegisterValidationError>> {
  const parsed = addMovementSchema.safeParse(input)
  if (!parsed.success) {
    return err({
      code: 'validation',
      message: parsed.error.issues[0]?.message ?? 'Datos del movimiento inválidos',
    })
  }
  const movement = await deps.repo.addMovement({
    cashSessionId: deps.cashSessionId,
    tipo: parsed.data.tipo,
    amount: parsed.data.amount,
    motivo: parsed.data.motivo,
    createdBy: deps.createdBy,
  })
  return ok(movement)
}
