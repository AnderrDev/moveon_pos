import { z } from 'zod'

export const inventoryLocationSchema = z.enum(['punto_venta', 'bodega'])

export const registerEntrySchema = z.object({
  productId:      z.string().uuid('ID de producto inválido'),
  cantidad:       z.number().positive('La cantidad debe ser mayor a 0'),
  ubicacion:      inventoryLocationSchema.default('bodega'),
  costoUnitario:  z.number().nonnegative().optional(),
  motivo:         z.string().max(200).optional(),
})

export const adjustStockSchema = z.object({
  productId:     z.string().uuid('ID de producto inválido'),
  cantidadDelta: z.number().refine((n) => n !== 0, 'El ajuste no puede ser cero'),
  ubicacion:     inventoryLocationSchema,
  motivo:        z.string().min(3, 'Describe el motivo del ajuste').max(200),
})

export const transferStockSchema = z
  .object({
    productId:       z.string().uuid('ID de producto inválido'),
    fromUbicacion:   inventoryLocationSchema,
    toUbicacion:     inventoryLocationSchema,
    cantidad:        z.number().positive('La cantidad debe ser mayor a 0'),
    motivo:          z.string().min(3, 'Describe el motivo del traslado').max(200),
  })
  .refine((value) => value.fromUbicacion !== value.toUbicacion, {
    message: 'El origen y destino deben ser diferentes',
    path:    ['toUbicacion'],
  })

