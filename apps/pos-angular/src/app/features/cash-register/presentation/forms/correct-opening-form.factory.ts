import type { z } from 'zod'
import { correctOpeningSchema } from '@angular-app/features/cash-register/domain/dtos/cash-register.dto'

/** Corrección del monto de apertura: reglas del DTO sin el id de la sesión. */
export const correctOpeningFormSchema = correctOpeningSchema.omit({ sessionId: true })

export type CorrectOpeningFormValue = z.infer<typeof correctOpeningFormSchema>

export function createCorrectOpeningDefaults(
  initial: Partial<CorrectOpeningFormValue> = {},
): CorrectOpeningFormValue {
  return { newAmount: initial.newAmount ?? 0, reason: initial.reason ?? '' }
}
