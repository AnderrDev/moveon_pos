import type { z } from 'zod'
import { openSessionSchema } from '@angular-app/features/cash-register/domain/dtos/cash-register.dto'

/** Abrir caja: mismas reglas que el DTO del use-case. */
export const openSessionFormSchema = openSessionSchema

export type OpenSessionFormValue = z.infer<typeof openSessionFormSchema>

export function createOpenSessionDefaults(initial: Partial<OpenSessionFormValue> = {}): OpenSessionFormValue {
  return { openingAmount: initial.openingAmount ?? 0 }
}
