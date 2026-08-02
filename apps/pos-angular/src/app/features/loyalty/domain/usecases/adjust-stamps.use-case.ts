import type {
  AdjustStampsInput,
  LoyaltyRepository,
} from '@angular-app/features/loyalty/domain/repositories/loyalty.repository'

export interface AdjustStampsDeps {
  repo: Pick<LoyaltyRepository, 'adjustStamps'>
}

/**
 * Ajuste manual admin-only de sellos (RN-LF16). Sin validación de forma
 * propia — `adjustStampsFormSchema` (presentation/forms) ya es la fuente
 * única de validación del formulario y el RPC `adjust_loyalty_stamps`
 * re-valida en servidor (admin, motivo ≥ 3, delta ≠ 0). Seam delgado que
 * delega en el repositorio; los fallos se propagan como `throw`.
 */
export function adjustStamps(deps: AdjustStampsDeps, input: AdjustStampsInput): Promise<number> {
  return deps.repo.adjustStamps(input)
}
