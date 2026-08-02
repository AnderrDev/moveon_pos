import { describe, expect, it } from 'vitest'
import {
  createSaleSchema,
  voidSaleSchema,
  correctPaymentSchema,
  correctSaleCustomerSchema,
} from '@angular-app/features/sales/domain/dtos/sale.dto'

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

  it('acepta una venta sin pagos cuando el total queda en $0 (canje cubre el 100%)', () => {
    const result = createSaleSchema.safeParse({
      ...validSale,
      items: [{ ...validSale.items[0], discountAmount: 100000, total: 0 }],
      payments: [],
      subtotal: 100000,
      discountTotal: 100000,
      taxTotal: 0,
      total: 0,
    })
    expect(result.success).toBe(true)
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

describe('correctSaleCustomerSchema', () => {
  const validPayload = {
    saleId:    uuid,
    clienteId: '22222222-2222-4222-8222-222222222222',
    reason:    'El cliente llegó a caja después del cobro',
  }

  it('acepta una corrección válida', () => {
    expect(correctSaleCustomerSchema.safeParse(validPayload).success).toBe(true)
  })

  it('rechaza clienteId que no es UUID', () => {
    const result = correctSaleCustomerSchema.safeParse({ ...validPayload, clienteId: 'no-es-uuid' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/Cliente inválido/)
    }
  })

  it('rechaza motivo con menos de 10 caracteres', () => {
    const result = correctSaleCustomerSchema.safeParse({ ...validPayload, reason: 'corto' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/al menos 10 caracteres/)
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
