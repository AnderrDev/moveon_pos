import type { z } from 'zod'
import { correctMovementSchema } from '@angular-app/features/cash-register/domain/dtos/cash-register.dto'

/** Corrección de un movimiento (RN-C16): reglas del DTO sin el id, que aporta el diálogo. */
export const correctMovementFormSchema = correctMovementSchema.omit({ movementId: true })

export type CorrectMovementFormValue = z.infer<typeof correctMovementFormSchema>

export function createCorrectMovementDefaults(
  initial: Partial<CorrectMovementFormValue> = {},
): CorrectMovementFormValue {
  return {
    newAmount: initial.newAmount ?? 0,
    newMotivo: initial.newMotivo ?? '',
    reason: initial.reason ?? '',
  }
}
