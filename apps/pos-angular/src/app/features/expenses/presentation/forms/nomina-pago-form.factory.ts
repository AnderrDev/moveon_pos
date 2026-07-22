import { z } from 'zod'
import { EXPENSE_NOTES_MAX, expenseMetodoPagoSchema } from '@angular-app/features/expenses/domain/dtos/expense.dto'
import { todayLocalDate } from '@angular-app/features/expenses/presentation/forms/expense-form.factory'

const nominaTipoPagoSchema = z.enum(['mes', 'quincena1', 'quincena2', 'adelanto'])

export const nominaPagoFormSchema = z.object({
  tipo: nominaTipoPagoSchema,
  monto: z.number().int('El monto debe ser en pesos, sin decimales').positive('Ingresa el monto a pagar'),
  fechaGasto: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Selecciona la fecha del pago'),
  metodoPago: expenseMetodoPagoSchema,
  notas: z.string().trim().max(EXPENSE_NOTES_MAX).optional().or(z.literal('')),
})

export type NominaPagoFormValue = z.infer<typeof nominaPagoFormSchema>

export function createNominaPagoFormDefaults(
  initial: Partial<NominaPagoFormValue> = {},
): NominaPagoFormValue {
  return {
    tipo: initial.tipo ?? 'mes',
    monto: initial.monto ?? 0,
    fechaGasto: initial.fechaGasto ?? todayLocalDate(),
    metodoPago: initial.metodoPago ?? 'transferencia',
    notas: initial.notas ?? '',
  }
}
