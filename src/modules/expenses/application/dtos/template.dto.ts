import { z } from 'zod'
import { EXPENSE_CONCEPT_MAX, EXPENSE_CONCEPT_MIN } from './expense.dto'

export const saveTemplateSchema = z.object({
  /** Ausente al crear; presente al editar. */
  id: z.string().uuid().optional(),
  tiendaId: z.string().uuid(),
  categoryId: z.string().uuid('Selecciona una categoría válida'),
  concepto: z
    .string()
    .trim()
    .min(EXPENSE_CONCEPT_MIN, `El concepto debe tener al menos ${EXPENSE_CONCEPT_MIN} caracteres`)
    .max(EXPENSE_CONCEPT_MAX),
  montoSugerido: z
    .number()
    .int('El monto debe ser un valor entero en pesos')
    .positive('El monto sugerido debe ser mayor a 0'),
  frecuencia: z.enum(['mensual', 'quincenal']),
})

export type SaveTemplateDto = z.infer<typeof saveTemplateSchema>
