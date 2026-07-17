import { z } from 'zod'
import { DEFAULT_LOYALTY_CONFIG } from '@angular-app/features/loyalty/domain/loyalty-config'

/**
 * Configuración del programa MOVE ON Club (PLAN-59, ADR 0013 §6).
 * Única fuente de validación del formulario en /configuracion; el RPC
 * `loyalty_program_config` aplica los mismos defaults del lado del servidor.
 */
export const loyaltySettingsFormSchema = z.object({
  activo: z.boolean(),
  sellosParaRecompensa: z
    .number({ invalid_type_error: 'Ingresa cuántos sellos dan una recompensa' })
    .int('Debe ser un número entero')
    .min(1, 'Mínimo 1 sello')
    .max(50, 'Máximo 50 sellos'),
  valorRecompensaCop: z
    .number({ invalid_type_error: 'Ingresa el valor máximo de la recompensa' })
    .min(0, 'No puede ser negativo')
    .max(10_000_000, 'Máximo $10.000.000'),
  vigenciaDias: z
    .number({ invalid_type_error: 'Ingresa la vigencia en días' })
    .int('Debe ser un número entero')
    .min(1, 'Mínimo 1 día')
    .max(365, 'Máximo 365 días'),
})

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
