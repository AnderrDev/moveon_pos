import { err, ok, type Result } from '@/shared/result'
import type { CashSession } from '@angular-app/features/cash-register/domain/entities/cash-session.entity'
import type { CashRegisterRepository } from '@angular-app/features/cash-register/domain/repositories/cash-register.repository'
import { openSessionSchema } from '@angular-app/features/cash-register/domain/dtos/cash-register.dto'

export interface OpenCashSessionDeps {
  repo: Pick<CashRegisterRepository, 'openSession'>
  tiendaId: string
  openedBy: string
}

export interface CashRegisterValidationError {
  code: 'validation'
  message: string
}

/**
 * Valida y abre una sesión de caja. Errores de dominio como `Result`; los
 * fallos técnicos del repositorio se propagan como `throw` (mismo patrón que
 * createCustomer/createProduct).
 */
export async function openCashSession(
  deps: OpenCashSessionDeps,
  input: unknown,
): Promise<Result<CashSession, CashRegisterValidationError>> {
  const parsed = openSessionSchema.safeParse(input)
  if (!parsed.success) {
    return err({
      code: 'validation',
      message: parsed.error.issues[0]?.message ?? 'Monto de apertura inválido',
    })
  }
  const session = await deps.repo.openSession({
    tiendaId: deps.tiendaId,
    openedBy: deps.openedBy,
    openingAmount: parsed.data.openingAmount,
  })
  return ok(session)
}
