import { z } from 'zod'

export const inventoryLocationSchema = z.enum(['punto_venta', 'bodega'])

/** Cómo se pagó una compra de mercancía (mismos valores que los gastos). */
export const entryPaymentMethodSchema = z.enum(['efectivo_caja', 'efectivo_externo', 'transferencia', 'tarjeta'])

export const ENTRY_CASH_PAYMENT_NEEDS_COST = 'Para pagar con efectivo de caja registra el costo de la compra'

export const registerEntryFieldsSchema = z.object({
  productId: z.string().uuid('ID de producto inválido'),
  cantidad: z.number().positive('La cantidad debe ser mayor a 0'),
  ubicacion: inventoryLocationSchema.default('bodega'),
  costoUnitario: z.number().nonnegative().optional(),
  motivo: z.string().max(200).optional(),
  /** Sin método = el pago no se registra. Efectivo de caja crea la salida de caja. */
  metodoPago: entryPaymentMethodSchema.optional(),
})

/** Pagar con efectivo de caja crea una salida por cantidad × costo: exige costo. */
export function entryCashPaymentHasCost(v: { metodoPago?: string | null; costoUnitario?: number | null }): boolean {
  return v.metodoPago !== 'efectivo_caja' || (v.costoUnitario ?? 0) > 0
}

export const registerEntrySchema = registerEntryFieldsSchema.refine(entryCashPaymentHasCost, {
  message: ENTRY_CASH_PAYMENT_NEEDS_COST,
  path: ['costoUnitario'],
})

export const INVENTORY_COST_CORRECTION_REASON_MIN_LENGTH = 10
export const INVENTORY_COST_CORRECTION_REASON_MAX_LENGTH = 200

export const correctEntryCostSchema = z.object({
  movementId: z.string().uuid('ID de movimiento inválido'),
  newCost: z.number().positive('El nuevo costo debe ser mayor a 0'),
  updateProductCost: z.boolean(),
  reason: z
    .string()
    .trim()
    .min(
      INVENTORY_COST_CORRECTION_REASON_MIN_LENGTH,
      `El motivo debe tener al menos ${INVENTORY_COST_CORRECTION_REASON_MIN_LENGTH} caracteres`
    )
    .max(INVENTORY_COST_CORRECTION_REASON_MAX_LENGTH),
})

export const adjustStockSchema = z.object({
  productId: z.string().uuid('ID de producto inválido'),
  cantidadDelta: z.number().refine((n) => n !== 0, 'El ajuste no puede ser cero'),
  ubicacion: inventoryLocationSchema,
  motivo: z.string().min(3, 'Describe el motivo del ajuste').max(200),
})

export const transferStockFieldsSchema = z.object({
  productId: z.string().uuid('ID de producto inválido'),
  fromUbicacion: inventoryLocationSchema,
  toUbicacion: inventoryLocationSchema,
  cantidad: z.number().positive('La cantidad debe ser mayor a 0'),
  motivo: z.string().min(3, 'Describe el motivo del traslado').max(200),
})

/** Regla del traslado, compartida por el DTO y el formulario. */
export function transferLocationsDiffer(value: { fromUbicacion: string; toUbicacion: string }): boolean {
  return value.fromUbicacion !== value.toUbicacion
}

export const TRANSFER_LOCATIONS_ERROR = {
  message: 'El origen y destino deben ser diferentes',
  path: ['toUbicacion'],
}

export const transferStockSchema = transferStockFieldsSchema.refine(transferLocationsDiffer, TRANSFER_LOCATIONS_ERROR)
