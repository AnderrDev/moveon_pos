import { err, ok, type Result } from '@/shared/result'
import type { CashRegisterRepository } from '@angular-app/features/cash-register/domain/repositories/cash-register.repository'
import { voidMovementSchema } from '@angular-app/features/cash-register/domain/dtos/cash-register.dto'
import type { CashRegisterValidationError } from '@angular-app/features/cash-register/domain/usecases/open-session.use-case'

export interface VoidCashMovementDeps {
  repo: Pick<CashRegisterRepository, 'voidMovement'>
  tiendaId: string
  voidedBy: string
}

/** Valida y anula un movimiento de caja. Mismo contrato de errores que `openCashSession`. */
export async function voidCashMovement(
  deps: VoidCashMovementDeps,
  input: unknown,
): Promise<Result<void, CashRegisterValidationError>> {
  const parsed = voidMovementSchema.safeParse(input)
  if (!parsed.success) {
    return err({
      code: 'validation',
      message: parsed.error.issues[0]?.message ?? 'Motivo de anulación inválido',
    })
  }
  await deps.repo.voidMovement({
    movementId: parsed.data.movementId,
    tiendaId: deps.tiendaId,
    voidedBy: deps.voidedBy,
    voidedReason: parsed.data.reason,
  })
  return ok(undefined)
}
