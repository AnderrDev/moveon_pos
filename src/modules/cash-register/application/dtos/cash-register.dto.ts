import { z } from 'zod'

export const openSessionSchema = z.object({
  openingAmount: z.number().nonnegative('El monto de apertura no puede ser negativo'),
})

export const addMovementSchema = z.object({
  tipo:   z.enum(['cash_in', 'cash_out', 'expense', 'correction']),
  amount: z.number().positive('El monto debe ser mayor a 0'),
  motivo: z.string().min(3, 'Describe el motivo').max(200),
})

export const closeSessionSchema = z.object({
  actualCashAmount: z.number().nonnegative('El conteo de efectivo no puede ser negativo'),
  notasCierre:      z.string().max(500).optional(),
})

export type OpenSessionDto  = z.infer<typeof openSessionSchema>
export type AddMovementDto  = z.infer<typeof addMovementSchema>
export type CloseSessionDto = z.infer<typeof closeSessionSchema>
