import { describe, expect, it } from 'vitest'
import { buildMonthlyComparison, lastMonths } from './monthly-comparison'

describe('lastMonths', () => {
  it('devuelve los últimos n meses en orden ascendente, cruzando el año', () => {
    expect(lastMonths(3, new Date(2026, 0, 15))).toEqual(['2025-11', '2025-12', '2026-01'])
  })
})

describe('buildMonthlyComparison', () => {
  it('combina totales mensuales de entradas y gastos y calcula % y balance', () => {
    const rows = buildMonthlyComparison({
      entradas: [
        { month: '2026-06', total: 5_000_000 },
        { month: '2026-07', total: 5_000_000 },
      ],
      gastos: [
        { month: '2026-06', total: 1_800_000 },
        { month: '2026-07', total: 1_000_000 },
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
      entradas: [],
      gastos: [{ month: '2026-07', total: 500_000 }],
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

  it('meses fuera del rango pedido se ignoran', () => {
    const rows = buildMonthlyComparison({
      entradas: [{ month: '2026-01', total: 1_000_000 }],
      gastos: [],
      months: ['2026-07'],
    })
    expect(rows).toEqual([
      { month: '2026-07', entradas: 0, gastos: 0, pctGastos: null, balance: 0 },
    ])
  })
})
