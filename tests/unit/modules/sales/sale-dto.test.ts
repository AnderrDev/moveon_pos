import { describe, expect, it } from 'vitest'
import {
  createSaleSchema,
  voidSaleSchema,
  correctPaymentSchema,
} from '@/modules/sales/application/dtos/sale.dto'

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

describe('correctPaymentSchema', () => {
  const validPayload = {
    paymentId: uuid,
    newMetodo: 'card',
    reason: 'El cliente pagó con tarjeta, no con efectivo',
  }

  it('acepta una corrección válida', () => {
    expect(correctPaymentSchema.safeParse(validPayload).success).toBe(true)
  })

  it('rechaza paymentId que no es UUID', () => {
    const result = correctPaymentSchema.safeParse({ ...validPayload, paymentId: 'no-es-uuid' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/ID de pago inválido/)
    }
  })

  it('rechaza método de pago inválido', () => {
    const result = correctPaymentSchema.safeParse({ ...validPayload, newMetodo: 'bitcoin' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/Método de pago inválido/)
    }
  })

  it('rechaza motivo con menos de 10 caracteres', () => {
    const result = correctPaymentSchema.safeParse({ ...validPayload, reason: 'Corto' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/al menos 10 caracteres/)
    }
  })

  it('rechaza motivo que solo tiene espacios en blanco', () => {
    const result = correctPaymentSchema.safeParse({ ...validPayload, reason: '          ' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/al menos 10 caracteres/)
    }
  })

  it('rechaza motivo que supera 200 caracteres', () => {
    const result = correctPaymentSchema.safeParse({ ...validPayload, reason: 'a'.repeat(201) })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/200 caracteres/)
    }
  })
})
