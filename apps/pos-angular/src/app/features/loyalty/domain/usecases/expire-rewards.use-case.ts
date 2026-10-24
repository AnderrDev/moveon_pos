import { z } from 'zod'
import { err, ok, type Result } from '@/shared/result'
import type { LoyaltyRepository } from '@angular-app/features/loyalty/domain/repositories/loyalty.repository'
import type { LoyaltyValidationError } from '@angular-app/features/loyalty/domain/usecases/adjust-stamps.use-case'

export interface ExpireRewardsDeps {
  repo: Pick<LoyaltyRepository, 'expireRewards'>
}

const tiendaIdSchema = z.string().uuid('Tienda inválida')

/**
 * Barrido de vencimiento (RN-LF09): marca `expired` las recompensas vencidas
 * de la tienda y devuelve cuántas venció. Los fallos técnicos se propagan
 * como `throw`; los llamadores lo tratan como oportunista.
 */
export async function expireRewards(
  deps: ExpireRewardsDeps,
  tiendaId: string,
): Promise<Result<number, LoyaltyValidationError>> {
  const parsed = tiendaIdSchema.safeParse(tiendaId)
  if (!parsed.success) {
    return err({ code: 'validation', message: parsed.error.issues[0]?.message ?? 'Tienda inválida' })
  }
  return ok(await deps.repo.expireRewards(parsed.data))
}
