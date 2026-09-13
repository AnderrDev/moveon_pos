import type { LoyaltyCustomerProgress } from '@angular-app/features/loyalty/domain/repositories/loyalty.repository'

export function getStampsRemaining(stampsBalance: number, stampsPerReward: number): number {
  const threshold = Math.max(1, Math.floor(stampsPerReward))
  return Math.max(0, threshold - Math.max(0, stampsBalance))
}

/**
 * Prioriza premios ya disponibles; si no los hay, devuelve el mayor saldo
 * positivo. En empates conserva el orden recibido para que la UI sea estable.
 */
export function selectFeaturedLoyaltyProgress(
  progress: readonly LoyaltyCustomerProgress[]
): LoyaltyCustomerProgress | null {
  let featured: LoyaltyCustomerProgress | null = null

  for (const current of progress) {
    if (current.availableRewards <= 0 && current.stampsBalance <= 0) continue
    if (!featured) {
      featured = current
      continue
    }

    if (
      current.availableRewards > featured.availableRewards ||
      (current.availableRewards === featured.availableRewards &&
        current.stampsBalance > featured.stampsBalance)
    ) {
      featured = current
    }
  }

  return featured
}
