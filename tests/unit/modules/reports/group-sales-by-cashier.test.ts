import { describe, expect, it } from 'vitest'
import {
  groupSalesByCashier,
  type CashierSalesSummary,
} from '@/modules/reports/domain/services/group-sales-by-cashier'
import type { Sale } from '@/modules/sales/domain/entities/sale.entity'
import type { SaleStatus } from '@/shared/types'

/**
 * Construye un `Sale` mínimo con solo los campos que consume
 * `groupSalesByCashier` (`cashierId`, `status`, `total`, `taxTotal`). El resto
 * se completa con valores neutros para satisfacer el tipo.
 */
function makeSale(overrides: {
  cashierId: string
  status: SaleStatus
  total: number
  taxTotal: number
}): Sale {
  const now = new Date('2026-05-27T15:00:00.000Z')
  return {
    id: 'sale-id',
    tiendaId: 'tienda-1',
    cashSessionId: 'session-1',
    saleNumber: 'V-0001',
    clienteId: null,
    clienteNombre: null,
    cashierId: overrides.cashierId,
    cashierEmail: `${overrides.cashierId}@example.com`,
    status: overrides.status,
    billingStatus: 'pending',
    billingDocumentId: null,
    items: [],
    payments: [],
    subtotal: overrides.total - overrides.taxTotal,
    discountTotal: 0,
    taxTotal: overrides.taxTotal,
    total: overrides.total,
    change: 0,
    idempotencyKey: 'key',
    voidedBy: null,
    voidedAt: null,
    voidedReason: null,
    createdAt: now,
    updatedAt: now,
  }
}

describe('groupSalesByCashier', () => {
  it('agrupa 2 cajeros en 2 grupos con conteos y totales correctos', () => {
    const result = groupSalesByCashier([
      makeSale({ cashierId: 'cashier-a', status: 'completed', total: 10_000, taxTotal: 1_596 }),
      makeSale({ cashierId: 'cashier-b', status: 'completed', total: 30_000, taxTotal: 4_790 }),
    ])

    expect(result).toHaveLength(2)
    const byId = Object.fromEntries(result.map((r) => [r.cashierId, r]))
    expect(byId['cashier-a']).toMatchObject<Partial<CashierSalesSummary>>({
      countCompleted: 1,
      countVoided: 0,
      totalVentas: 10_000,
      taxTotal: 1_596,
    })
    expect(byId['cashier-b']).toMatchObject<Partial<CashierSalesSummary>>({
      countCompleted: 1,
      countVoided: 0,
      totalVentas: 30_000,
      taxTotal: 4_790,
    })
  })

  it('excluye anuladas del total/IVA pero las cuenta en countVoided', () => {
    const result = groupSalesByCashier([
      makeSale({ cashierId: 'cashier-a', status: 'completed', total: 10_000, taxTotal: 1_596 }),
      makeSale({ cashierId: 'cashier-a', status: 'voided', total: 50_000, taxTotal: 7_983 }),
    ])

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject<Partial<CashierSalesSummary>>({
      cashierId: 'cashier-a',
      countCompleted: 1,
      countVoided: 1,
      totalVentas: 10_000,
      taxTotal: 1_596,
    })
  })

  it('un cajero con varias ventas agrega solo las completadas', () => {
    const result = groupSalesByCashier([
      makeSale({ cashierId: 'cashier-a', status: 'completed', total: 10_000, taxTotal: 1_000 }),
      makeSale({ cashierId: 'cashier-a', status: 'completed', total: 20_000, taxTotal: 2_000 }),
      makeSale({ cashierId: 'cashier-a', status: 'completed', total: 5_000, taxTotal: 500 }),
    ])

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject<Partial<CashierSalesSummary>>({
      cashierId: 'cashier-a',
      countCompleted: 3,
      countVoided: 0,
      totalVentas: 35_000,
      taxTotal: 3_500,
    })
  })

  it('lista vacía devuelve []', () => {
    expect(groupSalesByCashier([])).toEqual([])
  })

  it('ordena por totalVentas desc y desempata por cashierId asc', () => {
    const result = groupSalesByCashier([
      // mismo total → desempate por cashierId asc (z después de a)
      makeSale({ cashierId: 'cashier-z', status: 'completed', total: 20_000, taxTotal: 0 }),
      makeSale({ cashierId: 'cashier-a', status: 'completed', total: 20_000, taxTotal: 0 }),
      // total mayor → primero
      makeSale({ cashierId: 'cashier-m', status: 'completed', total: 50_000, taxTotal: 0 }),
    ])

    expect(result.map((r) => r.cashierId)).toEqual(['cashier-m', 'cashier-a', 'cashier-z'])
  })

  it('cajero solo con anuladas: total 0, countCompleted 0, countVoided > 0', () => {
    const result = groupSalesByCashier([
      makeSale({ cashierId: 'cashier-a', status: 'voided', total: 40_000, taxTotal: 6_387 }),
      makeSale({ cashierId: 'cashier-a', status: 'voided', total: 10_000, taxTotal: 1_596 }),
    ])

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject<Partial<CashierSalesSummary>>({
      cashierId: 'cashier-a',
      countCompleted: 0,
      countVoided: 2,
      totalVentas: 0,
      taxTotal: 0,
    })
  })
})
