import { describe, it, expect } from 'vitest'
import {
  calculateCartItem,
  calculateCartTotals,
  calculateChange,
  validateDiscountAuthorization,
  validatePaymentsForSale,
} from '@/modules/sales/domain/services/sale-calculator'

describe('calculateCartItem', () => {
  it('calcula correctamente sin IVA ni descuento', () => {
    const result = calculateCartItem({
      productId: '1', nombre: 'Agua', sku: null,
      unitPrice: 2000, ivaTasa: 0, quantity: 3, discountAmount: 0,
    })
    expect(result.subtotalBruto).toBe(6000)
    expect(result.descuentoTotal).toBe(0)
    expect(result.taxAmount).toBe(0)
    expect(result.total).toBe(6000)
  })

  it('aplica IVA 19% sobre la base imponible', () => {
    const result = calculateCartItem({
      productId: '1', nombre: 'Suplemento', sku: null,
      unitPrice: 100000, ivaTasa: 19, quantity: 1, discountAmount: 0,
    })
    expect(result.baseImponible).toBe(100000)
    expect(result.taxAmount).toBe(19000)
    expect(result.total).toBe(119000)
  })

  it('aplica descuento ANTES de calcular IVA', () => {
    const result = calculateCartItem({
      productId: '1', nombre: 'Proteína', sku: null,
      unitPrice: 100000, ivaTasa: 19, quantity: 1, discountAmount: 10000,
    })
    expect(result.descuentoTotal).toBe(10000)
    expect(result.baseImponible).toBe(90000)
    expect(result.taxAmount).toBe(17100)   // 90000 * 0.19
    expect(result.total).toBe(107100)
  })

  it('multiplica descuento por cantidad', () => {
    const result = calculateCartItem({
      productId: '1', nombre: 'Barra', sku: null,
      unitPrice: 5000, ivaTasa: 0, quantity: 4, discountAmount: 500,
    })
    expect(result.subtotalBruto).toBe(20000)
    expect(result.descuentoTotal).toBe(2000)   // 500 * 4
    expect(result.total).toBe(18000)
  })

  it('maneja IVA 5%', () => {
    const result = calculateCartItem({
      productId: '1', nombre: 'Batido', sku: null,
      unitPrice: 10000, ivaTasa: 5, quantity: 2, discountAmount: 0,
    })
    expect(result.taxAmount).toBe(1000)   // 20000 * 0.05
    expect(result.total).toBe(21000)
  })
})

describe('calculateCartTotals', () => {
  it('suma correctamente múltiples ítems', () => {
    const items = [
      calculateCartItem({ productId: '1', nombre: 'A', sku: null, unitPrice: 10000, ivaTasa: 0,  quantity: 2, discountAmount: 0 }),
      calculateCartItem({ productId: '2', nombre: 'B', sku: null, unitPrice: 50000, ivaTasa: 19, quantity: 1, discountAmount: 0 }),
    ]
    const totals = calculateCartTotals(items)
    expect(totals.subtotal).toBe(70000)       // 20000 + 50000
    expect(totals.taxTotal).toBe(9500)        // 0 + 9500
    expect(totals.total).toBe(79500)          // 20000 + 59500
    expect(totals.discountTotal).toBe(0)
  })

  it('devuelve ceros para carrito vacío', () => {
    const totals = calculateCartTotals([])
    expect(totals.total).toBe(0)
    expect(totals.taxTotal).toBe(0)
  })
})

describe('calculateChange', () => {
  it('calcula cambio cuando se paga de más', () => {
    expect(calculateChange(50000, 43000)).toBe(7000)
  })

  it('devuelve 0 cuando se paga exacto', () => {
    expect(calculateChange(43000, 43000)).toBe(0)
  })

  it('devuelve 0 cuando se paga de menos (no negativo)', () => {
    expect(calculateChange(20000, 43000)).toBe(0)
  })
})

describe('validatePaymentsForSale', () => {
  it('acepta pago exacto', () => {
    expect(validatePaymentsForSale([{ metodo: 'card', amount: 50000 }], 50000)).toBeNull()
  })

  it('rechaza pagos por debajo del total', () => {
    expect(validatePaymentsForSale([{ metodo: 'cash', amount: 40000 }], 50000)).toBe(
      'La suma de pagos no cubre el total de la venta',
    )
  })

  it('acepta cambio cuando el excedente viene de efectivo', () => {
    expect(validatePaymentsForSale([
      { metodo: 'card', amount: 30000 },
      { metodo: 'cash', amount: 25000 },
    ], 50000)).toBeNull()
  })

  it('rechaza cambio generado por pago no efectivo', () => {
    expect(validatePaymentsForSale([{ metodo: 'card', amount: 55000 }], 50000)).toBe(
      'El cambio solo puede generarse desde pagos en efectivo',
    )
  })
})

describe('validateDiscountAuthorization', () => {
  it('permite descuento de cajero hasta 10%', () => {
    expect(validateDiscountAuthorization('cajero', 100000, 10000)).toBeNull()
  })

  it('rechaza descuento de cajero mayor al 10%', () => {
    expect(validateDiscountAuthorization('cajero', 100000, 10001)).toBe(
      'Descuentos mayores al 10% requieren aprobación de admin',
    )
  })

  it('permite descuento de admin por encima del umbral', () => {
    expect(validateDiscountAuthorization('admin', 100000, 50000)).toBeNull()
  })
})
