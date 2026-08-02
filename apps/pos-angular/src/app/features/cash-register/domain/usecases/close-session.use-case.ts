import { err, ok, type Result } from '@/shared/result'
import type { CashSession } from '@angular-app/features/cash-register/domain/entities/cash-session.entity'
import type { CashRegisterRepository } from '@angular-app/features/cash-register/domain/repositories/cash-register.repository'
import { closeSessionSchema } from '@angular-app/features/cash-register/domain/dtos/cash-register.dto'
import type { CashRegisterValidationError } from '@angular-app/features/cash-register/domain/usecases/open-session.use-case'
import type { PaymentMethod } from '@/shared/types'

export interface CloseCashSessionDeps {
  repo: Pick<CashRegisterRepository, 'closeSession'>
  sessionId: string
  tiendaId: string
  closedBy: string
}

/**
 * Valida y cierra la sesión de caja. El DTO valida el conteo por método
 * (`actualCashAmount` + `actualCardAmount`/`actualTransferAmount`/
 * `actualOtherAmount`, con default 0); el use-case los reempaqueta en
 * `actualPayments` — la forma que espera el repositorio (RPC
 * `close_cash_session_atomic`, que agrupa por método y trata cualquier
 * método ausente igual que un total en 0).
 */
export async function closeCashSession(
  deps: CloseCashSessionDeps,
  input: unknown,
): Promise<Result<CashSession, CashRegisterValidationError>> {
  const parsed = closeSessionSchema.safeParse(input)
  if (!parsed.success) {
    return err({
      code: 'validation',
      message: parsed.error.issues[0]?.message ?? 'Datos de cierre inválidos',
    })
  }
  const actualPayments: { metodo: PaymentMethod; total: number }[] = [
    { metodo: 'card', total: parsed.data.actualCardAmount },
    { metodo: 'transfer', total: parsed.data.actualTransferAmount },
    { metodo: 'other', total: parsed.data.actualOtherAmount },
  ]
  const session = await deps.repo.closeSession({
    sessionId: deps.sessionId,
    tiendaId: deps.tiendaId,
    closedBy: deps.closedBy,
    actualCashAmount: parsed.data.actualCashAmount,
    actualPayments,
    notasCierre: parsed.data.notasCierre,
  })
  return ok(session)
}
