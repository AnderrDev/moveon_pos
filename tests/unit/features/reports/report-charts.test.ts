import { describe, expect, it } from 'vitest'
import {
  buildDailyPoints,
  buildHourlyPoints,
  buildPaymentPoints,
  buildTopProductPoints,
  peakHour,
} from '@angular-app/features/reports/presentation/services/report-charts'
import type { DailyProductSale } from '@angular-app/features/reports/domain/entities/report.entity'

describe('puntos de las gráficas de reportes', () => {
  it('rellena con cero los días sin ventas del período', () => {
    const points = buildDailyPoints(
      [
        { date: '2026-10-20', count: 3, total: 90_000, avgTicket: 30_000 },
        { date: '2026-10-22', count: 1, total: 15_000, avgTicket: 15_000 },
      ],
      '2026-10-20',
      '2026-10-23',
    )
    expect(points.map((p) => [p.key, p.value, p.detail])).toEqual([
      ['2026-10-20', 90_000, '3 ventas'],
      ['2026-10-21', 0, '0 ventas'],
      ['2026-10-22', 15_000, '1 venta'],
      ['2026-10-23', 0, '0 ventas'],
    ])
    expect(points[0].label).toBe('mar 20')
  })

  it('con períodos largos agrupa por semana', () => {
    const points = buildDailyPoints([{ date: '2026-08-03', count: 2, total: 10_000, avgTicket: 5_000 }], '2026-08-01', '2026-10-24')
    expect(points.length).toBe(13)
    expect(points[0]).toMatchObject({ value: 10_000, detail: 'Semana · 2 ventas' })
  })

  it('cubre de 7 a. m. a 9 p. m. y amplía si hay ventas fuera', () => {
    const points = buildHourlyPoints([
      { hour: 6, count: 1, total: 5_000, avgTicket: 5_000 },
      { hour: 18, count: 4, total: 80_000, avgTicket: 20_000 },
    ])
    expect(points[0]).toMatchObject({ key: '6', label: '6 a. m.', value: 5_000 })
    expect(points[points.length - 1].label).toBe('9 p. m.')
    expect(points.find((p) => p.key === '12')?.label).toBe('12 p. m.')
    expect(peakHour([{ hour: 18, count: 4, total: 80_000, avgTicket: 20_000 }])).toEqual({ label: '6 p. m.', total: 80_000 })
    expect(peakHour([])).toBeNull()
  })

  it('métodos de pago y top de productos', () => {
    expect(buildPaymentPoints([{ metodo: 'cash', count: 2, total: 30_000 }, { metodo: 'card', count: 0, total: 0 }])).toEqual([
      { key: 'cash', label: 'Efectivo', value: 30_000, detail: '2 ventas' },
    ])
    const product = (productId: string, total: number, qty: number): DailyProductSale => ({
      productId, nombre: productId, sku: null, numVentas: 1, qty, total, avgPrice: 0,
      costoUnitario: null, costoTotal: null, utilidad: null, margenPct: null,
    })
    const top = buildTopProductPoints([product('a', 10, 1), product('b', 50, 3), product('c', 0, 0)], 1)
    expect(top).toEqual([{ key: 'b', label: 'b', value: 50, detail: '3 unidades' }])
  })
})
