import { describe, expect, it } from 'vitest'
import { buildSalesSummary } from '@angular-app/features/reports/domain/services/sales-summary'
import type { Payment, Sale, SaleItem } from '@angular-app/features/sales/domain/entities/sale.entity'
import type { PaymentMethod, SaleStatus } from '@/shared/types'

const TZ = 'America/Bogota'

function makeItem(o: { productId: string; quantity: number; total: number; unitCost?: number | null }): SaleItem {
  return {
    id: `item-${o.productId}-${Math.random()}`,
    saleId: 'unused',
    productId: o.productId,
    productoNombre: `Producto ${o.productId}`,
    productoSku: null,
    quantity: o.quantity,
    unitPrice: o.total / o.quantity,
    unitCost: o.unitCost === undefined ? null : o.unitCost,
    optionNombre: null,
    optionExtra: 0,
    discountAmount: 0,
    globalDiscountAmount: 0,
    taxRate: 0,
    taxAmount: 0,
    total: o.total,
  }
}

function makeSale(o: {
  id: string
  status?: SaleStatus
  createdAt: string
  items: SaleItem[]
  payments?: [PaymentMethod, number][]
  cashierId?: string
  subtotal?: number
  discountTotal?: number
}): Sale {
  const total = o.items.reduce((s, i) => s + i.total, 0)
  const payments: Payment[] = (o.payments ?? [['cash', total]]).map(([metodo, amount], i) => ({
    id: `${o.id}-p${i}`,
    saleId: o.id,
    metodo,
    amount,
    referencia: null,
    cardSurcharge: 0,
    createdAt: new Date(o.createdAt),
  }))
  return {
    id: o.id,
    tiendaId: 'tienda-1',
    cashSessionId: 'session-1',
    saleNumber: `V-${o.id}`,
    clienteId: null,
    clienteNombre: null,
    cashierId: o.cashierId ?? 'cashier-1',
    cashierEmail: null,
    status: o.status ?? 'completed',
    billingStatus: 'not_required',
    billingDocumentId: null,
    items: o.items,
    payments,
    subtotal: o.subtotal ?? total,
    itemDiscountTotal: 0,
    globalDiscountTotal: o.discountTotal ?? 0,
    discountTotal: o.discountTotal ?? 0,
    discountReason: null,
    discountApprovedBy: null,
    taxTotal: 0,
    cardSurcharge: 0,
    total,
    change: 0,
    idempotencyKey: o.id,
    voidedBy: null,
    voidedAt: null,
    voidedReason: null,
    createdAt: new Date(o.createdAt),
    updatedAt: new Date(o.createdAt),
  }
}

describe('buildSalesSummary', () => {
  it('sin ventas devuelve ceros y listas vacías', () => {
    const summary = buildSalesSummary([], TZ)
    expect(summary).toMatchObject({
      totalVentas: 0,
      countVentas: 0,
      countAnuladas: 0,
      avgVenta: 0,
      averageDiscountPercentage: 0,
      utilidadTotal: 0,
      paymentBreakdown: [],
      productSales: [],
      cashierBreakdown: [],
      hourlySales: [],
      dailySales: [],
    })
  })

  it('suma solo las completadas y cuenta las anuladas aparte', () => {
    const summary = buildSalesSummary(
      [
        makeSale({ id: 'a', createdAt: '2026-10-24T15:00:00Z', items: [makeItem({ productId: 'p1', quantity: 1, total: 10000 })] }),
        makeSale({ id: 'b', createdAt: '2026-10-24T16:00:00Z', items: [makeItem({ productId: 'p1', quantity: 2, total: 21000 })] }),
        makeSale({ id: 'c', status: 'voided', createdAt: '2026-10-24T17:00:00Z', items: [makeItem({ productId: 'p1', quantity: 1, total: 99000 })] }),
      ],
      TZ
    )
    expect(summary.totalVentas).toBe(31000)
    expect(summary.countVentas).toBe(2)
    expect(summary.countAnuladas).toBe(1)
    expect(summary.avgVenta).toBe(15500)
    expect(summary.cashierBreakdown).toEqual([
      { cashierId: 'cashier-1', countCompleted: 2, countVoided: 1, totalVentas: 31000, taxTotal: 0 },
    ])
  })

  it('agrupa pagos mixtos por método, ordenados por total', () => {
    const summary = buildSalesSummary(
      [
        makeSale({
          id: 'a',
          createdAt: '2026-10-24T15:00:00Z',
          items: [makeItem({ productId: 'p1', quantity: 1, total: 30000 })],
          payments: [['cash', 10000], ['transfer', 20000]],
        }),
        makeSale({ id: 'b', createdAt: '2026-10-24T16:00:00Z', items: [makeItem({ productId: 'p1', quantity: 1, total: 5000 })] }),
      ],
      TZ
    )
    expect(summary.paymentBreakdown).toEqual([
      { metodo: 'transfer', count: 1, total: 20000 },
      { metodo: 'cash', count: 2, total: 15000 },
    ])
  })

  it('informa el recargo por tarjeta aparte, sin sumarlo al total ni a los pagos (ADR 0024)', () => {
    const conTarjeta = {
      ...makeSale({
        id: 'a',
        createdAt: '2026-10-24T15:00:00Z',
        items: [makeItem({ productId: 'p1', quantity: 1, total: 85000 })],
        payments: [['card', 85000]],
      }),
      cardSurcharge: 2062,
    }
    const anulada = {
      ...makeSale({ id: 'b', status: 'voided', createdAt: '2026-10-24T16:00:00Z', items: [makeItem({ productId: 'p1', quantity: 1, total: 30000 })] }),
      cardSurcharge: 727,
    }
    const summary = buildSalesSummary([conTarjeta, anulada], TZ)
    expect(summary.totalVentas).toBe(85000)
    expect(summary.cardSurchargeTotal).toBe(2062)
    expect(summary.cardSurchargeSalesCount).toBe(1)
    expect(summary.paymentBreakdown).toEqual([{ metodo: 'card', count: 1, total: 85000 }])
  })

  it('la utilidad excluye productos con costo desconocido (ADR 0019)', () => {
    const summary = buildSalesSummary(
      [
        makeSale({
          id: 'a',
          createdAt: '2026-10-24T15:00:00Z',
          items: [
            makeItem({ productId: 'p1', quantity: 2, total: 20000, unitCost: 4000 }),
            makeItem({ productId: 'p2', quantity: 1, total: 8000, unitCost: null }),
          ],
        }),
      ],
      TZ
    )
    const p1 = summary.productSales.find((p) => p.productId === 'p1')
    const p2 = summary.productSales.find((p) => p.productId === 'p2')
    expect(p1).toMatchObject({ costoTotal: 8000, costoUnitario: 4000, utilidad: 12000, margenPct: 60 })
    expect(p2).toMatchObject({ costoTotal: null, costoUnitario: null, utilidad: null, margenPct: null })
    expect(summary.utilidadTotal).toBe(12000)
  })

  it('promedia el porcentaje de descuento solo sobre las ventas con descuento', () => {
    const summary = buildSalesSummary(
      [
        makeSale({
          id: 'a',
          createdAt: '2026-10-24T15:00:00Z',
          items: [makeItem({ productId: 'p1', quantity: 1, total: 9000 })],
          subtotal: 10000,
          discountTotal: 1000,
        }),
        makeSale({
          id: 'b',
          createdAt: '2026-10-24T16:00:00Z',
          items: [makeItem({ productId: 'p1', quantity: 1, total: 7000 })],
          subtotal: 10000,
          discountTotal: 3000,
        }),
        makeSale({ id: 'c', createdAt: '2026-10-24T17:00:00Z', items: [makeItem({ productId: 'p1', quantity: 1, total: 5000 })] }),
      ],
      TZ
    )
    expect(summary.discountedSalesCount).toBe(2)
    expect(summary.averageDiscountPercentage).toBeCloseTo(20)
    expect(summary.discountTotal).toBe(4000)
  })

  it('una venta a las 23:30 hora Colombia cuenta en ese día y esa hora local', () => {
    const summary = buildSalesSummary(
      [makeSale({ id: 'a', createdAt: '2026-10-25T04:30:00Z', items: [makeItem({ productId: 'p1', quantity: 1, total: 5000 })] })],
      TZ
    )
    expect(summary.hourlySales).toEqual([{ hour: 23, count: 1, total: 5000, avgTicket: 5000 }])
    expect(summary.dailySales).toEqual([{ date: '2026-10-24', count: 1, total: 5000, avgTicket: 5000 }])
  })
})
