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
  actualCardAmount: z.number().nonnegative('El total de tarjeta no puede ser negativo').default(0),
  actualNequiAmount: z.number().nonnegative('El total de Nequi no puede ser negativo').default(0),
  actualDaviplataAmount: z.number().nonnegative('El total de Daviplata no puede ser negativo').default(0),
  actualTransferAmount: z.number().nonnegative('El total de transferencias no puede ser negativo').default(0),
  actualOtherAmount: z.number().nonnegative('El total de otros medios no puede ser negativo').default(0),
  notasCierre:      z.string().max(500).optional(),
})

export type OpenSessionDto  = z.infer<typeof openSessionSchema>
export type AddMovementDto  = z.infer<typeof addMovementSchema>
export type CloseSessionDto = z.infer<typeof closeSessionSchema>
