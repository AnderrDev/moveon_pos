import type { LoyaltyConfig } from '@angular-app/features/loyalty/domain/loyalty-config'
import type { LoyaltySettingsRepository } from '@angular-app/features/settings/domain/repositories/loyalty-settings.repository'

export interface SaveLoyaltySettingsDeps {
  repo: Pick<LoyaltySettingsRepository, 'save'>
}

/**
 * Guarda la configuración del programa MOVE ON Club. Sin validación de
 * forma propia — `loyaltySettingsFormSchema` (presentation/forms) ya es la
 * fuente única de validación del formulario. Seam delgado que delega en el
 * repositorio; los fallos (incluyendo el chequeo de rol admin) se propagan
 * como `throw`.
 */
export function saveLoyaltySettings(deps: SaveLoyaltySettingsDeps, value: LoyaltyConfig): Promise<void> {
  return deps.repo.save(value)
}
