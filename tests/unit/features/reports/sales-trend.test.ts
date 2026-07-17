import { describe, expect, it } from 'vitest'
import {
  groupSalesByLocalDay,
  groupSalesByLocalHour,
  type DailySalesSummary,
  type HourlySalesSummary,
} from '@angular-app/features/reports/domain/services/sales-trend'
import type { Sale } from '@angular-app/features/sales/domain/entities/sale.entity'
import type { SaleStatus } from '@/shared/types'

const TZ = 'America/Bogota'

/**
 * Construye un `Sale` mínimo con solo los campos que consume
 * `groupSalesByLocalHour`/`groupSalesByLocalDay` (`status`, `total`,
 * `createdAt`). El resto se completa con valores neutros para satisfacer el
 * tipo.
 */
function makeSale(overrides: { status: SaleStatus; total: number; createdAt: string }): Sale {
  const createdAt = new Date(overrides.createdAt)
  return {
    id: 'sale-id',
    tiendaId: 'tienda-1',
    cashSessionId: 'session-1',
    saleNumber: 'V-0001',
    clienteId: null,
    clienteNombre: null,
    cashierId: 'cashier-1',
    cashierEmail: 'cashier-1@example.com',
    status: overrides.status,
    billingStatus: 'pending',
    billingDocumentId: null,
    items: [],
    payments: [],
    subtotal: overrides.total,
    itemDiscountTotal: 0,
    globalDiscountTotal: 0,
    discountTotal: 0,
    discountReason: null,
    discountApprovedBy: null,
    taxTotal: 0,
    total: overrides.total,
    change: 0,
    idempotencyKey: 'key',
    voidedBy: null,
    voidedAt: null,
    voidedReason: null,
    createdAt,
    updatedAt: createdAt,
  }
}

describe('groupSalesByLocalHour', () => {
  it('venta a las 14:30Z (09:30 local Bogotá) cae en la hora 9', () => {
    const result = groupSalesByLocalHour(
      [makeSale({ status: 'completed', total: 10_000, createdAt: '2026-06-22T14:30:00.000Z' })],
      TZ
    )

    expect(result).toEqual<HourlySalesSummary[]>([
      { hour: 9, count: 1, total: 10_000, avgTicket: 10_000 },
    ])
  })

  it('venta a las 04:50Z del día siguiente (23:50 local Bogotá del día anterior) cae en la hora 23, no en getUTCHours()', () => {
    const result = groupSalesByLocalHour(
      [makeSale({ status: 'completed', total: 10_000, createdAt: '2026-06-23T04:50:00.000Z' })],
      TZ
    )

    expect(result).toEqual<HourlySalesSummary[]>([
      { hour: 23, count: 1, total: 10_000, avgTicket: 10_000 },
    ])
  })

  it('dos ventas completadas en la misma hora local agregan en una sola fila', () => {
    const result = groupSalesByLocalHour(
      [
        makeSale({ status: 'completed', total: 10_000, createdAt: '2026-06-22T14:10:00.000Z' }), // 09:10 local
        makeSale({ status: 'completed', total: 15_000, createdAt: '2026-06-22T14:45:00.000Z' }), // 09:45 local
      ],
      TZ
    )

    expect(result).toEqual<HourlySalesSummary[]>([
      { hour: 9, count: 2, total: 25_000, avgTicket: 12_500 },
    ])
  })

  it('una venta anulada en una hora sin completadas no produce fila', () => {
    const result = groupSalesByLocalHour(
      [makeSale({ status: 'voided', total: 10_000, createdAt: '2026-06-22T14:30:00.000Z' })],
      TZ
    )

    expect(result).toEqual([])
  })

  it('una venta anulada en la misma hora que una completada no infla count/total', () => {
    const result = groupSalesByLocalHour(
      [
        makeSale({ status: 'completed', total: 10_000, createdAt: '2026-06-22T14:10:00.000Z' }),
        makeSale({ status: 'voided', total: 50_000, createdAt: '2026-06-22T14:20:00.000Z' }),
      ],
      TZ
    )

    expect(result).toEqual<HourlySalesSummary[]>([
      { hour: 9, count: 1, total: 10_000, avgTicket: 10_000 },
    ])
  })

  it('lista vacía devuelve []', () => {
    expect(groupSalesByLocalHour([], TZ)).toEqual([])
  })

  it('ordena ascendente por hora aunque las ventas lleguen desordenadas', () => {
    const result = groupSalesByLocalHour(
      [
        makeSale({ status: 'completed', total: 1_000, createdAt: '2026-06-22T19:00:00.000Z' }), // 14 local
        makeSale({ status: 'completed', total: 1_000, createdAt: '2026-06-22T14:00:00.000Z' }), // 9 local
        makeSale({ status: 'completed', total: 1_000, createdAt: '2026-06-23T02:00:00.000Z' }), // 21 local (día anterior)
      ],
      TZ
    )

    expect(result.map((r) => r.hour)).toEqual([9, 14, 21])
  })
})

describe('groupSalesByLocalDay', () => {
  it('venta a las 04:50Z (23:50 local Bogotá del día anterior) cae en el día local anterior', () => {
    const result = groupSalesByLocalDay(
      [makeSale({ status: 'completed', total: 10_000, createdAt: '2026-06-23T04:50:00.000Z' })],
      TZ
    )

    expect(result).toEqual<DailySalesSummary[]>([
      { date: '2026-06-22', count: 1, total: 10_000, avgTicket: 10_000 },
    ])
  })

  it('dos ventas completadas el mismo día local agregan en una sola fila', () => {
    const result = groupSalesByLocalDay(
      [
        makeSale({ status: 'completed', total: 10_000, createdAt: '2026-06-22T14:10:00.000Z' }),
        makeSale({ status: 'completed', total: 15_000, createdAt: '2026-06-22T20:00:00.000Z' }),
      ],
      TZ
    )

    expect(result).toEqual<DailySalesSummary[]>([
      { date: '2026-06-22', count: 2, total: 25_000, avgTicket: 12_500 },
    ])
  })

  it('un día solo con anuladas no produce fila; anulada en día con completadas no infla totales', () => {
    const onlyVoided = groupSalesByLocalDay(
      [makeSale({ status: 'voided', total: 40_000, createdAt: '2026-06-22T14:00:00.000Z' })],
      TZ
    )
    expect(onlyVoided).toEqual([])

    const mixed = groupSalesByLocalDay(
      [
        makeSale({ status: 'completed', total: 10_000, createdAt: '2026-06-22T14:00:00.000Z' }),
        makeSale({ status: 'voided', total: 90_000, createdAt: '2026-06-22T15:00:00.000Z' }),
      ],
      TZ
    )
    expect(mixed).toEqual<DailySalesSummary[]>([
      { date: '2026-06-22', count: 1, total: 10_000, avgTicket: 10_000 },
    ])
  })

  it('lista vacía devuelve []', () => {
    expect(groupSalesByLocalDay([], TZ)).toEqual([])
  })

  it('ordena ascendente por fecha aunque las ventas multi-día lleguen desordenadas', () => {
    const result = groupSalesByLocalDay(
      [
        makeSale({ status: 'completed', total: 1_000, createdAt: '2026-06-24T14:00:00.000Z' }),
        makeSale({ status: 'completed', total: 1_000, createdAt: '2026-06-22T14:00:00.000Z' }),
        makeSale({ status: 'completed', total: 1_000, createdAt: '2026-06-23T14:00:00.000Z' }),
      ],
      TZ
    )

    expect(result.map((r) => r.date)).toEqual(['2026-06-22', '2026-06-23', '2026-06-24'])
  })

  it('venta cerca de medianoche Bogotá que cruza mes/año agrupa en el día local correcto', () => {
    // 2026-06-01T04:30:00Z = 2026-05-31 23:30 hora Bogotá (UTC-5).
    const result = groupSalesByLocalDay(
      [makeSale({ status: 'completed', total: 5_000, createdAt: '2026-06-01T04:30:00.000Z' })],
      TZ
    )

    expect(result).toEqual<DailySalesSummary[]>([
      { date: '2026-05-31', count: 1, total: 5_000, avgTicket: 5_000 },
    ])
  })
})
