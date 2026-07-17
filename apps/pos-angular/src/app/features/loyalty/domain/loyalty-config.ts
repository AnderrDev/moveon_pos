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
