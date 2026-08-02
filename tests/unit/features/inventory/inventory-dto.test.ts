import { describe, expect, it } from 'vitest'
import {
  adjustStockSchema,
  registerEntrySchema,
  transferStockSchema,
} from '@angular-app/features/inventory/domain/dtos/inventory.dto'

const productId = '11111111-1111-4111-8111-111111111111'

describe('registerEntrySchema', () => {
  it('acepta una entrada válida', () => {
    const result = registerEntrySchema.safeParse({
      productId,
      cantidad: 10,
      ubicacion: 'bodega',
      costoUnitario: 50000,
      motivo: 'Compra proveedor',
    })
    expect(result.success).toBe(true)
  })

  it('rechaza cantidades en cero', () => {
    expect(registerEntrySchema.safeParse({ productId, cantidad: 0 }).success).toBe(false)
  })

  it('rechaza costo unitario negativo', () => {
    expect(registerEntrySchema.safeParse({ productId, cantidad: 1, costoUnitario: -1 }).success).toBe(false)
  })
})

describe('adjustStockSchema', () => {
  it('acepta ajustes positivos y negativos', () => {
    expect(adjustStockSchema.safeParse({ productId, cantidadDelta: 5, ubicacion: 'punto_venta', motivo: 'Conteo físico' }).success).toBe(true)
    expect(adjustStockSchema.safeParse({ productId, cantidadDelta: -2, ubicacion: 'bodega', motivo: 'Producto dañado' }).success).toBe(true)
  })

  it('rechaza ajuste en cero', () => {
    expect(adjustStockSchema.safeParse({ productId, cantidadDelta: 0, ubicacion: 'punto_venta', motivo: 'Conteo físico' }).success).toBe(false)
  })

  it('requiere motivo descriptivo', () => {
    expect(adjustStockSchema.safeParse({ productId, cantidadDelta: 1, ubicacion: 'punto_venta', motivo: 'ok' }).success).toBe(false)
  })

  it('requiere una ubicación válida', () => {
    expect(adjustStockSchema.safeParse({ productId, cantidadDelta: 1, ubicacion: 'estante', motivo: 'Conteo físico' }).success).toBe(false)
  })
})

describe('transferStockSchema', () => {
  it('acepta traslados entre bodega y punto de venta', () => {
    const result = transferStockSchema.safeParse({
      productId,
      fromUbicacion: 'bodega',
      toUbicacion: 'punto_venta',
      cantidad: 3,
      motivo: 'Reposicion mostrador',
    })
    expect(result.success).toBe(true)
  })

  it('rechaza origen y destino iguales', () => {
    const result = transferStockSchema.safeParse({
      productId,
      fromUbicacion: 'bodega',
      toUbicacion: 'bodega',
      cantidad: 3,
      motivo: 'Reposicion mostrador',
    })
    expect(result.success).toBe(false)
  })

  it('rechaza cantidades en cero', () => {
    const result = transferStockSchema.safeParse({
      productId,
      fromUbicacion: 'bodega',
      toUbicacion: 'punto_venta',
      cantidad: 0,
      motivo: 'Reposicion mostrador',
    })
    expect(result.success).toBe(false)
  })
})
