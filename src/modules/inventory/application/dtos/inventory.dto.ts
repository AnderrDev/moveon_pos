import { z } from 'zod'

export const registerEntrySchema = z.object({
  productId:      z.string().uuid('ID de producto inválido'),
  cantidad:       z.number().positive('La cantidad debe ser mayor a 0'),
  costoUnitario:  z.number().nonnegative().optional(),
  motivo:         z.string().max(200).optional(),
})

export const adjustStockSchema = z.object({
  productId:     z.string().uuid('ID de producto inválido'),
  cantidadDelta: z.number().refine((n) => n !== 0, 'El ajuste no puede ser cero'),
  motivo:        z.string().min(3, 'Describe el motivo del ajuste').max(200),
})

export type RegisterEntryDto = z.infer<typeof registerEntrySchema>
export type AdjustStockDto   = z.infer<typeof adjustStockSchema>
