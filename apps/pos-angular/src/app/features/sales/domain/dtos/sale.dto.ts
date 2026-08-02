import { z } from 'zod'

const paymentMethodEnum = z.enum(['cash', 'card', 'transfer', 'other'])

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

export const createSaleSchema = z
  .object({
    cashSessionId:  z.string().uuid('Sesión de caja inválida'),
    clienteId:      z.string().uuid().optional(),
    items:          z.array(saleItemSchema).min(1, 'La venta necesita al menos un ítem'),
    payments:       z.array(paymentInputSchema),
    subtotal:       z.number().nonnegative(),
    discountTotal:  z.number().nonnegative(),
    taxTotal:       z.number().nonnegative(),
    total:          z.number().nonnegative(),
    change:         z.number().nonnegative(),
    idempotencyKey: z.string().min(1),
  })
  .superRefine((data, ctx) => {
    // Un canje/descuento puede cubrir el 100% del total (RN-LF: "hasta $X"
    // del valor de la recompensa): la venta queda en $0 y no hay nada que
    // pagar. Solo se exige al menos un pago cuando el total es > 0.
    if (data.payments.length === 0 && data.total > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['payments'],
        message: 'Se requiere al menos un pago',
      })
    }
  })

export const voidSaleSchema = z.object({
  saleId:       z.string().uuid(),
  voidedReason: z.string().min(3, 'Describe el motivo de anulación').max(200),
})

export const correctPaymentSchema = z.object({
  paymentId: z.string().uuid('ID de pago inválido'),
  newMetodo: z.enum(['cash', 'card', 'transfer', 'other'], {
    errorMap: () => ({ message: 'Método de pago inválido' }),
  }),
  reason: z
    .string()
    .trim()
    .min(10, 'El motivo debe tener al menos 10 caracteres')
    .max(200, 'El motivo no puede superar 200 caracteres'),
})

export type CorrectPaymentDto  = z.infer<typeof correctPaymentSchema>

export const correctSaleCustomerSchema = z.object({
  saleId:    z.string().uuid('ID de venta inválido'),
  clienteId: z.string().uuid('Cliente inválido'),
  reason: z
    .string()
    .trim()
    .min(10, 'El motivo debe tener al menos 10 caracteres')
    .max(200, 'El motivo no puede superar 200 caracteres'),
})

export type CorrectSaleCustomerDto = z.infer<typeof correctSaleCustomerSchema>
