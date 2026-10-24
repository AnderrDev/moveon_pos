import { err, ok, type Result } from '@/shared/result'
import {
  loyaltyConfigSchema,
  type LoyaltyConfig,
} from '@angular-app/features/loyalty/domain/loyalty-config'
import type { LoyaltySettingsRepository } from '@angular-app/features/settings/domain/repositories/loyalty-settings.repository'
import type { SettingsValidationError } from '@angular-app/features/settings/domain/usecases/save-receipt-settings.use-case'

export interface SaveLoyaltySettingsDeps {
  repo: Pick<LoyaltySettingsRepository, 'save'>
}

/**
 * Guarda la configuración del programa MOVE ON Club. Valida con
 * `loyaltyConfigSchema` y devuelve `Result`; los fallos técnicos (incluido
 * el chequeo de rol admin del repositorio) se propagan como `throw`.
 */
export async function saveLoyaltySettings(
  deps: SaveLoyaltySettingsDeps,
  value: LoyaltyConfig,
): Promise<Result<void, SettingsValidationError>> {
  const parsed = loyaltyConfigSchema.safeParse(value)
  if (!parsed.success) {
    return err({ code: 'validation', message: parsed.error.issues[0]?.message ?? 'Configuración inválida' })
  }
  await deps.repo.save(parsed.data)
  return ok(undefined)
}
