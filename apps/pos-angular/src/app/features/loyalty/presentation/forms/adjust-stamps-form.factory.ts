import { z } from 'zod'

/**
 * Ajuste manual de sellos MOVE ON Club (RN-LF16, PLAN-58).
 * El RPC `adjust_loyalty_stamps` re-valida en servidor (admin, motivo ≥ 3,
 * delta ≠ 0); este schema es el borde del formulario.
 */
export const adjustStampsFormSchema = z.object({
  delta: z
    .number({ invalid_type_error: 'Ingresa cuántos sellos sumar o restar' })
    .int('Debe ser un número entero')
    .min(-99, 'Máximo 99 sellos por ajuste')
    .max(99, 'Máximo 99 sellos por ajuste')
    .refine((value) => value !== 0, 'El ajuste debe ser distinto de cero'),
  reason: z
    .string()
    .trim()
    .min(3, 'El motivo es obligatorio (mínimo 3 caracteres)')
    .max(200, 'Máximo 200 caracteres'),
})

export type AdjustStampsFormValue = z.infer<typeof adjustStampsFormSchema>

export interface AdjustStampsFormRaw {
  delta: number | null
  reason: string
}

export function createAdjustStampsFormDefaults(): AdjustStampsFormRaw {
  return { delta: null, reason: '' }
}
