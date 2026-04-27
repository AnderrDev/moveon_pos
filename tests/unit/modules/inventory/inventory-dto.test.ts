import { describe, expect, it } from 'vitest'
import {
  adjustStockSchema,
  registerEntrySchema,
} from '@/modules/inventory/application/dtos/inventory.dto'

const productId = '11111111-1111-4111-8111-111111111111'

describe('registerEntrySchema', () => {
  it('acepta una entrada válida', () => {
    const result = registerEntrySchema.safeParse({
      productId,
      cantidad: 10,
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
    expect(adjustStockSchema.safeParse({ productId, cantidadDelta: 5, motivo: 'Conteo físico' }).success).toBe(true)
    expect(adjustStockSchema.safeParse({ productId, cantidadDelta: -2, motivo: 'Producto dañado' }).success).toBe(true)
  })

  it('rechaza ajuste en cero', () => {
    expect(adjustStockSchema.safeParse({ productId, cantidadDelta: 0, motivo: 'Conteo físico' }).success).toBe(false)
  })

  it('requiere motivo descriptivo', () => {
    expect(adjustStockSchema.safeParse({ productId, cantidadDelta: 1, motivo: 'ok' }).success).toBe(false)
  })
})
