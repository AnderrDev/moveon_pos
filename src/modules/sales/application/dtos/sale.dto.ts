import { z } from 'zod'

const paymentMethodEnum = z.enum(['cash', 'card', 'nequi', 'daviplata', 'transfer', 'other'])

const saleItemSchema = z.object({
  productId:      z.string().uuid(),
  productoNombre: z.string().min(1),
  productoSku:    z.string().nullable(),
  quantity:       z.number().positive(),
  unitPrice:      z.number().nonnegative(),
  discountAmount: z.number().nonnegative(),
  taxRate:        z.number().nonnegative(),
  taxAmount:      z.number().nonnegative(),
  total:          z.number().nonnegative(),
})

const paymentInputSchema = z.object({
  metodo:     paymentMethodEnum,
  amount:     z.number().positive(),
  referencia: z.string().optional(),
})

export const createSaleSchema = z.object({
  cashSessionId:  z.string().uuid('Sesión de caja inválida'),
  clienteId:      z.string().uuid().optional(),
  items:          z.array(saleItemSchema).min(1, 'La venta necesita al menos un ítem'),
  payments:       z.array(paymentInputSchema).min(1, 'Se requiere al menos un pago'),
  subtotal:       z.number().nonnegative(),
  discountTotal:  z.number().nonnegative(),
  taxTotal:       z.number().nonnegative(),
  total:          z.number().nonnegative(),
  change:         z.number().nonnegative(),
  idempotencyKey: z.string().min(1),
})

export const voidSaleSchema = z.object({
  saleId:       z.string().uuid(),
  voidedReason: z.string().min(3, 'Describe el motivo de anulación').max(200),
})

export type CreateSaleDto = z.infer<typeof createSaleSchema>
export type VoidSaleDto   = z.infer<typeof voidSaleSchema>
