import { describe, expect, it } from 'vitest'
import { createSaleSchema, voidSaleSchema } from '@/modules/sales/application/dtos/sale.dto'

const uuid = '11111111-1111-4111-8111-111111111111'

describe('createSaleSchema', () => {
  const validSale = {
    cashSessionId: uuid,
    items: [
      {
        productId: uuid,
        productoNombre: 'Whey Protein',
        productoSku: 'WHY-001',
        quantity: 1,
        unitPrice: 100000,
        discountAmount: 0,
        taxRate: 19,
        taxAmount: 19000,
        total: 119000,
      },
    ],
    payments: [{ metodo: 'cash', amount: 119000 }],
    subtotal: 100000,
    discountTotal: 0,
    taxTotal: 19000,
    total: 119000,
    change: 0,
    idempotencyKey: 'session-123',
  }

  it('acepta una venta válida', () => {
    expect(createSaleSchema.safeParse(validSale).success).toBe(true)
  })

  it('requiere al menos un item', () => {
    const result = createSaleSchema.safeParse({ ...validSale, items: [] })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/ítem/)
    }
  })

  it('requiere al menos un pago', () => {
    const result = createSaleSchema.safeParse({ ...validSale, payments: [] })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/pago/)
    }
  })

  it('rechaza montos de pago negativos', () => {
    const result = createSaleSchema.safeParse({
      ...validSale,
      payments: [{ metodo: 'cash', amount: -1 }],
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['payments', 0, 'amount'])
    }
  })
})

describe('voidSaleSchema', () => {
  it('acepta una anulación válida', () => {
    const result = voidSaleSchema.safeParse({
      saleId: uuid,
      voidedReason: 'Error en el producto',
    })
    expect(result.success).toBe(true)
  })

  it('requiere motivo descriptivo', () => {
    const result = voidSaleSchema.safeParse({
      saleId: uuid,
      voidedReason: 'no',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/motivo/)
    }
  })
})
