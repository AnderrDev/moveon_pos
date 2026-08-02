import { err, ok, type Result } from '@/shared/result'
import type { CashSession } from '@angular-app/features/cash-register/domain/entities/cash-session.entity'
import type { CashRegisterRepository } from '@angular-app/features/cash-register/domain/repositories/cash-register.repository'
import { correctOpeningSchema } from '@angular-app/features/cash-register/domain/dtos/cash-register.dto'
import type { CashRegisterValidationError } from '@angular-app/features/cash-register/domain/usecases/open-session.use-case'

export interface CorrectCashSessionOpeningDeps {
  repo: Pick<CashRegisterRepository, 'correctOpening'>
  tiendaId: string
  correctedBy: string
}

/** Valida y corrige el monto de apertura. Mismo contrato de errores que `openCashSession`. */
export async function correctCashSessionOpening(
  deps: CorrectCashSessionOpeningDeps,
  input: unknown,
): Promise<Result<CashSession, CashRegisterValidationError>> {
  const parsed = correctOpeningSchema.safeParse(input)
  if (!parsed.success) {
    return err({
      code: 'validation',
      message: parsed.error.issues[0]?.message ?? 'Datos de corrección inválidos',
    })
  }
  const session = await deps.repo.correctOpening({
    sessionId: parsed.data.sessionId,
    tiendaId: deps.tiendaId,
    newAmount: parsed.data.newAmount,
    correctedBy: deps.correctedBy,
    reason: parsed.data.reason,
  })
  return ok(session)
}
