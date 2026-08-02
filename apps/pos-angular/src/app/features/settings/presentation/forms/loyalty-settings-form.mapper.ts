import type { LoyaltyConfig } from '@angular-app/features/loyalty/domain/loyalty-config'
import type { LoyaltySettingsFormValue } from '@angular-app/features/settings/presentation/forms/loyalty-settings-form.factory'

export const loyaltySettingsFormMapper = {
  toFormValue(config: LoyaltyConfig): LoyaltySettingsFormValue {
    return {
      activo: config.activo,
      sellosParaRecompensa: config.sellosParaRecompensa,
      valorRecompensaCop: config.valorRecompensaCop,
      vigenciaDias: config.vigenciaDias,
    }
  },

  toPayload(value: LoyaltySettingsFormValue): LoyaltyConfig {
    return {
      activo: value.activo,
      sellosParaRecompensa: value.sellosParaRecompensa,
      valorRecompensaCop: value.valorRecompensaCop,
      vigenciaDias: value.vigenciaDias,
    }
  },
}
