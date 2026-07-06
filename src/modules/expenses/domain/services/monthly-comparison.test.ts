import { describe, expect, it } from 'vitest'
import { buildMonthlyComparison, lastMonths } from './monthly-comparison'

describe('lastMonths', () => {
  it('devuelve los últimos n meses en orden ascendente, cruzando el año', () => {
    expect(lastMonths(3, new Date(2026, 0, 15))).toEqual(['2025-11', '2025-12', '2026-01'])
  })
})

describe('buildMonthlyComparison', () => {
  it('agrupa entradas y gastos por mes y calcula % y balance', () => {
    const rows = buildMonthlyComparison({
      sales: [
        { total: 5_000_000, createdAt: new Date(2026, 5, 10) },
        { total: 3_000_000, createdAt: new Date(2026, 6, 2) },
        { total: 2_000_000, createdAt: new Date(2026, 6, 20) },
      ],
      gastos: [
        { monto: 1_800_000, fechaGasto: '2026-06-30', status: 'active' },
        { monto: 1_000_000, fechaGasto: '2026-07-01', status: 'active' },
        { monto: 999_999, fechaGasto: '2026-07-02', status: 'voided' },
      ],
      months: ['2026-06', '2026-07'],
    })

    expect(rows).toEqual([
      { month: '2026-06', entradas: 5_000_000, gastos: 1_800_000, pctGastos: 36, balance: 3_200_000 },
      { month: '2026-07', entradas: 5_000_000, gastos: 1_000_000, pctGastos: 20, balance: 4_000_000 },
    ])
  })

  it('meses sin entradas: pctGastos null y balance negativo', () => {
    const rows = buildMonthlyComparison({
      sales: [],
      gastos: [{ monto: 500_000, fechaGasto: '2026-07-01', status: 'active' }],
      months: ['2026-07'],
    })
    expect(rows[0]).toEqual({
      month: '2026-07',
      entradas: 0,
      gastos: 500_000,
      pctGastos: null,
      balance: -500_000,
    })
  })
})
