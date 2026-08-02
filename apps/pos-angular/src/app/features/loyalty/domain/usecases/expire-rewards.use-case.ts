import type { LoyaltyRepository } from '@angular-app/features/loyalty/domain/repositories/loyalty.repository'

export interface ExpireRewardsDeps {
  repo: Pick<LoyaltyRepository, 'expireRewards'>
}

/**
 * Barrido de vencimiento (RN-LF09): marca `expired` las recompensas vencidas
 * de la tienda. Sin validación de forma (solo `tiendaId`) — seam estable
 * para reglas futuras. Los fallos se propagan como `throw`; los llamadores
 * actuales lo tratan como oportunista (`.catch(() => 0)`).
 */
export function expireRewards(deps: ExpireRewardsDeps, tiendaId: string): Promise<number> {
  return deps.repo.expireRewards(tiendaId)
}
