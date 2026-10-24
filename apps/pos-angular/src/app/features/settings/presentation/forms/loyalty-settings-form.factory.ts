import type { z } from 'zod'
import {
  DEFAULT_LOYALTY_CONFIG,
  loyaltyConfigSchema,
} from '@angular-app/features/loyalty/domain/loyalty-config'

/**
 * Configuración del programa MOVE ON Club (PLAN-59, ADR 0013 §6).
 * Las reglas viven en `loyaltyConfigSchema` (dominio); el RPC
 * `loyalty_program_config` aplica los mismos defaults del lado del servidor.
 */
export const loyaltySettingsFormSchema = loyaltyConfigSchema

export type LoyaltySettingsFormValue = z.infer<typeof loyaltySettingsFormSchema>

export function createLoyaltySettingsFormDefaults(
  initial: Partial<LoyaltySettingsFormValue> = {},
): LoyaltySettingsFormValue {
  return {
    activo: initial.activo ?? DEFAULT_LOYALTY_CONFIG.activo,
    sellosParaRecompensa:
      initial.sellosParaRecompensa ?? DEFAULT_LOYALTY_CONFIG.sellosParaRecompensa,
    valorRecompensaCop: initial.valorRecompensaCop ?? DEFAULT_LOYALTY_CONFIG.valorRecompensaCop,
    vigenciaDias: initial.vigenciaDias ?? DEFAULT_LOYALTY_CONFIG.vigenciaDias,
  }
}
