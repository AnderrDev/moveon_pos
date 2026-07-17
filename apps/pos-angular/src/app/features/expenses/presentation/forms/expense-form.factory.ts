import { z } from 'zod'
import {
  EXPENSE_CONCEPT_MAX,
  EXPENSE_CONCEPT_MIN,
  EXPENSE_NOTES_MAX,
  expenseMetodoPagoSchema,
} from '@angular-app/features/expenses/domain/dtos/expense.dto'

export const expenseFormSchema = z.object({
  categoryId: z.string().uuid('Selecciona una categoría'),
  concepto: z
    .string()
    .trim()
    .min(EXPENSE_CONCEPT_MIN, `El concepto debe tener al menos ${EXPENSE_CONCEPT_MIN} caracteres`)
    .max(EXPENSE_CONCEPT_MAX),
  monto: z.number().int('El monto debe ser en pesos, sin decimales').positive('Ingresa el monto del gasto'),
  fechaGasto: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Selecciona la fecha del gasto'),
  metodoPago: expenseMetodoPagoSchema,
  notas: z.string().trim().max(EXPENSE_NOTES_MAX).optional().or(z.literal('')),
})

export type ExpenseFormValue = z.infer<typeof expenseFormSchema>

/** Fecha local `YYYY-MM-DD` (no UTC — el negocio opera en hora de Colombia). */
export function todayLocalDate(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function createExpenseFormDefaults(
  initial: Partial<ExpenseFormValue> = {},
): ExpenseFormValue {
  return {
    categoryId: initial.categoryId ?? '',
    concepto: initial.concepto ?? '',
    monto: initial.monto ?? 0,
    fechaGasto: initial.fechaGasto ?? todayLocalDate(),
    metodoPago: initial.metodoPago ?? 'efectivo_externo',
    notas: initial.notas ?? '',
  }
}
