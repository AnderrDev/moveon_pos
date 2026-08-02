import { z } from 'zod'

export const EXPENSE_CONCEPT_MIN = 3
export const EXPENSE_CONCEPT_MAX = 120
export const EXPENSE_NOTES_MAX = 500

/** Mínimo de caracteres del motivo de anulación (mismo umbral que caja). */
export const VOID_EXPENSE_REASON_MIN_LENGTH = 10

export const expenseMetodoPagoSchema = z.enum([
  'efectivo_caja',
  'efectivo_externo',
  'transferencia',
  'tarjeta',
])

const fechaLocalSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (se espera YYYY-MM-DD)')

/** `YYYY-MM` (mes) o `YYYY-MM-Q1`/`YYYY-MM-Q2` (quincena). */
const periodoSchema = z
  .string()
  .regex(/^\d{4}-\d{2}(-Q[12])?$/, 'Período inválido (se espera YYYY-MM o YYYY-MM-Q1/Q2)')

export const createExpenseSchema = z.object({
  tiendaId: z.string().uuid(),
  categoryId: z.string().uuid('Selecciona una categoría válida'),
  empleadoId: z.string().uuid().optional(),
  concepto: z
    .string()
    .trim()
    .min(EXPENSE_CONCEPT_MIN, `El concepto debe tener al menos ${EXPENSE_CONCEPT_MIN} caracteres`)
    .max(EXPENSE_CONCEPT_MAX),
  notas: z.string().trim().max(EXPENSE_NOTES_MAX).optional(),
  monto: z.number().int('El monto debe ser un valor entero en pesos').positive('El monto debe ser mayor a 0'),
  fechaGasto: fechaLocalSchema,
  metodoPago: expenseMetodoPagoSchema,
  periodo: periodoSchema.optional(),
})

export type CreateExpenseDto = z.infer<typeof createExpenseSchema>

export const voidExpenseSchema = z.object({
  expenseId: z.string().uuid(),
  tiendaId: z.string().uuid(),
  motivo: z
    .string()
    .trim()
    .min(
      VOID_EXPENSE_REASON_MIN_LENGTH,
      `El motivo debe tener al menos ${VOID_EXPENSE_REASON_MIN_LENGTH} caracteres`,
    )
    .max(300),
})

export type VoidExpenseDto = z.infer<typeof voidExpenseSchema>
