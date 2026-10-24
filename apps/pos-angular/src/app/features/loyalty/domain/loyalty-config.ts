import { z } from 'zod'

/**
 * Configuración del programa MOVE ON Club (ADR 0013 §6).
 * Vive en `settings.data.fidelizacion`; estos defaults se replican en el RPC
 * `loyalty_program_config` — si cambian aquí deben cambiar allá.
 */
export interface LoyaltyConfig {
  activo: boolean
  sellosParaRecompensa: number
  valorRecompensaCop: number
  vigenciaDias: number
}

export const DEFAULT_LOYALTY_CONFIG: LoyaltyConfig = {
  activo: true,
  sellosParaRecompensa: 8,
  valorRecompensaCop: 11_000,
  vigenciaDias: 30,
}

/** Reglas de la configuración del club; el formulario de /configuracion las reutiliza. */
export const loyaltyConfigSchema = z.object({
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
}) satisfies z.ZodType<LoyaltyConfig>
