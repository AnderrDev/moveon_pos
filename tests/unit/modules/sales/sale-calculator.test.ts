import { describe, it, expect } from 'vitest'
import {
  applyGlobalDiscount,
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

  it('extrae el IVA 19% incluido sin aumentar el precio de venta', () => {
    const result = calculateCartItem({
      productId: '1', nombre: 'Suplemento', sku: null,
      unitPrice: 100000, ivaTasa: 19, quantity: 1, discountAmount: 0,
    })
    expect(result.baseImponible).toBe(84034)
    expect(result.taxAmount).toBe(15966)
    expect(result.total).toBe(100000)
  })

  it('mantiene en $79.000 un producto gravado al 19% (regresión)', () => {
    const result = calculateCartItem({
      productId: '1', nombre: 'Creatina', sku: null,
      unitPrice: 79000, ivaTasa: 19, quantity: 1, discountAmount: 0,
    })

    expect(result.taxAmount).toBe(12613)
    expect(result.total).toBe(79000)
  })

  it('aplica el descuento al precio final y extrae el IVA restante', () => {
    const result = calculateCartItem({
      productId: '1', nombre: 'Proteína', sku: null,
      unitPrice: 100000, ivaTasa: 19, quantity: 1, discountAmount: 10000,
    })
    expect(result.descuentoTotal).toBe(10000)
    expect(result.baseImponible).toBe(75630)
    expect(result.taxAmount).toBe(14370)
    expect(result.total).toBe(90000)
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
    expect(result.taxAmount).toBe(952)
    expect(result.total).toBe(20000)
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
    expect(totals.taxTotal).toBe(7983)        // IVA incluido en los $50.000
    expect(totals.total).toBe(70000)
    expect(totals.discountTotal).toBe(0)
  })

  it('devuelve ceros para carrito vacío', () => {
    const totals = calculateCartTotals([])
    expect(totals.total).toBe(0)
    expect(totals.taxTotal).toBe(0)
  })

  it('global = 0 es idéntico al cálculo sin descuento global (regresión)', () => {
    const items = [
      calculateCartItem({ productId: '1', nombre: 'A', sku: null, unitPrice: 10000, ivaTasa: 0,  quantity: 2, discountAmount: 0 }),
      calculateCartItem({ productId: '2', nombre: 'B', sku: null, unitPrice: 50000, ivaTasa: 19, quantity: 1, discountAmount: 0 }),
    ]
    expect(calculateCartTotals(items, 0)).toEqual(calculateCartTotals(items))
  })

  it('aplica descuento global sobre el total con IVA mixto (19/5/0) y descuento por ítem', () => {
    const items = [
      // IVA 19% incluido con descuento: total 90000, IVA contenido 14370
      calculateCartItem({ productId: '1', nombre: 'Proteína', sku: null, unitPrice: 100000, ivaTasa: 19, quantity: 1, discountAmount: 10000 }),
      // IVA 5% incluido: total 20000, IVA contenido 952
      calculateCartItem({ productId: '2', nombre: 'Batido',   sku: null, unitPrice: 10000,  ivaTasa: 5,  quantity: 2, discountAmount: 0 }),
      // IVA 0%: base 6000, total 6000
      calculateCartItem({ productId: '3', nombre: 'Agua',     sku: null, unitPrice: 2000,   ivaTasa: 0,  quantity: 3, discountAmount: 0 }),
    ]
    const totals = calculateCartTotals(items, 5000)

    expect(totals.subtotal).toBe(126000)      // 100000 + 20000 + 6000 brutos
    expect(totals.discountTotal).toBe(15000)  // 10000 por ítem + 5000 global
    expect(totals.taxTotal).toBe(14661)       // IVA recalculado tras prorratear el global
    expect(totals.total).toBe(111000)         // (90000 + 20000 + 6000) − 5000
  })

  it('acota el descuento global al total (nunca negativo)', () => {
    const items = [
      calculateCartItem({ productId: '1', nombre: 'A', sku: null, unitPrice: 10000, ivaTasa: 0, quantity: 1, discountAmount: 0 }),
    ]
    const totals = calculateCartTotals(items, 999999)

    expect(totals.total).toBe(0)
    expect(totals.discountTotal).toBe(10000)  // clamp al total disponible
    expect(totals.taxTotal).toBe(0)
  })
})

describe('applyGlobalDiscount', () => {
  const base = { subtotal: 100000, discountTotal: 0, taxTotal: 19000, total: 119000 }

  it('resta el descuento del total y lo suma a discountTotal', () => {
    const result = applyGlobalDiscount(base, 10000)
    expect(result.total).toBe(109000)
    expect(result.discountTotal).toBe(10000)
    expect(result.taxTotal).toBe(19000)       // intacto
    expect(result.subtotal).toBe(100000)      // intacto
  })

  it('global = 0 devuelve los totales sin cambios', () => {
    expect(applyGlobalDiscount(base, 0)).toEqual(base)
  })

  it('clampa el descuento al total (total nunca negativo)', () => {
    const result = applyGlobalDiscount(base, 500000)
    expect(result.total).toBe(0)
    expect(result.discountTotal).toBe(119000)
  })

  it('ignora montos negativos', () => {
    expect(applyGlobalDiscount(base, -5000)).toEqual(base)
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
