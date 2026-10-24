import { z } from 'zod'
import {
  stampsDeltaSchema,
  stampsReasonSchema,
} from '@angular-app/features/loyalty/domain/dtos/adjust-stamps.dto'

/**
 * Ajuste manual de sellos MOVE ON Club (RN-LF16, PLAN-58).
 * El RPC `adjust_loyalty_stamps` re-valida en servidor (admin, motivo ≥ 3,
 * delta ≠ 0); este schema es el borde del formulario y reutiliza las reglas
 * de dominio (`adjust-stamps.dto.ts`).
 */
export const adjustStampsFormSchema = z.object({
  delta: stampsDeltaSchema,
  reason: stampsReasonSchema,
})

export type AdjustStampsFormValue = z.infer<typeof adjustStampsFormSchema>

export interface AdjustStampsFormRaw {
  delta: number | null
  reason: string
}

export function createAdjustStampsFormDefaults(): AdjustStampsFormRaw {
  return { delta: null, reason: '' }
}
