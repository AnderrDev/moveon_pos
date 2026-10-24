import { z } from 'zod'
import {
  INVENTORY_COST_CORRECTION_REASON_MAX_LENGTH,
  INVENTORY_COST_CORRECTION_REASON_MIN_LENGTH,
} from '@angular-app/features/inventory/domain/dtos/inventory.dto'

export const entryCostCorrectionFormSchema = z.object({
  newCost: z.number().positive('El nuevo costo debe ser mayor a 0'),
  updateProductCost: z.boolean(),
  reason: z
    .string()
    .trim()
    .min(
      INVENTORY_COST_CORRECTION_REASON_MIN_LENGTH,
      `El motivo debe tener al menos ${INVENTORY_COST_CORRECTION_REASON_MIN_LENGTH} caracteres`
    )
    .max(INVENTORY_COST_CORRECTION_REASON_MAX_LENGTH),
})

export type EntryCostCorrectionFormValue = z.infer<typeof entryCostCorrectionFormSchema>

export function createEntryCostCorrectionDefaults(
  initial: Partial<EntryCostCorrectionFormValue> = {}
): EntryCostCorrectionFormValue {
  return {
    newCost: initial.newCost ?? 0,
    updateProductCost: initial.updateProductCost ?? false,
    reason: initial.reason ?? '',
  }
}
