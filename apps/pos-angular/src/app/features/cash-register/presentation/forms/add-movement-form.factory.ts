import { z } from 'zod'
import { addMovementSchema } from '@angular-app/features/cash-register/domain/dtos/cash-register.dto'

/** Movimiento de caja: reglas del DTO; el motivo se recorta antes de validarlo. */
export const addMovementFormSchema = addMovementSchema.extend({
  motivo: z.string().trim().pipe(addMovementSchema.shape.motivo),
})

export type AddMovementFormValue = z.infer<typeof addMovementFormSchema>

export function createAddMovementDefaults(initial: Partial<AddMovementFormValue> = {}): AddMovementFormValue {
  return {
    tipo: initial.tipo ?? 'cash_in',
    amount: initial.amount ?? 0,
    motivo: initial.motivo ?? '',
  }
}
