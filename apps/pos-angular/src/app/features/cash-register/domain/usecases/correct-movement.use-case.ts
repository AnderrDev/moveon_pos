import { err, ok, type Result } from '@/shared/result'
import type { CashRegisterRepository } from '@angular-app/features/cash-register/domain/repositories/cash-register.repository'
import { correctMovementSchema } from '@angular-app/features/cash-register/domain/dtos/cash-register.dto'
import type { CashRegisterValidationError } from '@angular-app/features/cash-register/domain/usecases/open-session.use-case'

export interface CorrectCashMovementDeps {
  repo: Pick<CashRegisterRepository, 'correctMovement'>
  tiendaId: string
  correctedBy: string
}

/**
 * Corrige el monto y el motivo de un movimiento de caja ya registrado (RN-C16).
 * El RPC revalida todo — que la caja siga abierta, que el movimiento no esté
 * anulado y que algo haya cambiado — porque el cliente no es autoridad de nada
 * de eso.
 */
export async function correctCashMovement(
  deps: CorrectCashMovementDeps,
  input: unknown,
): Promise<Result<void, CashRegisterValidationError>> {
  const parsed = correctMovementSchema.safeParse(input)
  if (!parsed.success) {
    return err({
      code: 'validation',
      message: parsed.error.issues[0]?.message ?? 'Datos de corrección inválidos',
    })
  }

  await deps.repo.correctMovement({
    movementId: parsed.data.movementId,
    tiendaId: deps.tiendaId,
    newAmount: parsed.data.newAmount,
    newMotivo: parsed.data.newMotivo,
    correctedBy: deps.correctedBy,
    reason: parsed.data.reason,
  })
  return ok(undefined)
}
