import { describe, expect, it } from 'vitest'
import { buildMonthlyComparison, lastMonths } from '@angular-app/features/expenses/domain/services/monthly-comparison'

describe('lastMonths', () => {
  it('devuelve los últimos n meses en orden ascendente, cruzando el año', () => {
    expect(lastMonths(3, new Date(2026, 0, 15))).toEqual(['2025-11', '2025-12', '2026-01'])
  })
})

describe('buildMonthlyComparison', () => {
  it('ganancia = ventas − mercancía vendida − gastos, igual que el resumen del mes', () => {
    const rows = buildMonthlyComparison({
      entradas: [
        { month: '2026-06', total: 5_000_000 },
        { month: '2026-07', total: 5_000_000 },
      ],
      costoMercancia: [
        { month: '2026-06', total: 2_500_000 },
        { month: '2026-07', total: 3_000_000 },
      ],
      gastos: [
        { month: '2026-06', total: 1_800_000 },
        { month: '2026-07', total: 1_000_000 },
      ],
      months: ['2026-06', '2026-07'],
    })

    expect(rows).toEqual([
      {
        month: '2026-06',
        entradas: 5_000_000,
        costoMercancia: 2_500_000,
        gastos: 1_800_000,
        ganancia: 700_000,
        margen: 14,
        pctGastos: 36,
        balance: 3_200_000,
      },
      {
        month: '2026-07',
        entradas: 5_000_000,
        costoMercancia: 3_000_000,
        gastos: 1_000_000,
        ganancia: 1_000_000,
        margen: 20,
        pctGastos: 20,
        balance: 4_000_000,
      },
    ])
  })

  it('meses sin entradas: porcentajes null y ganancia negativa', () => {
    const rows = buildMonthlyComparison({
      entradas: [],
      gastos: [{ month: '2026-07', total: 500_000 }],
      months: ['2026-07'],
    })
    expect(rows[0]).toEqual({
      month: '2026-07',
      entradas: 0,
      costoMercancia: 0,
      gastos: 500_000,
      ganancia: -500_000,
      margen: null,
      pctGastos: null,
      balance: -500_000,
    })
  })

  it('meses fuera del rango pedido se ignoran', () => {
    const rows = buildMonthlyComparison({
      entradas: [{ month: '2026-01', total: 1_000_000 }],
      costoMercancia: [{ month: '2026-01', total: 400_000 }],
      gastos: [],
      months: ['2026-07'],
    })
    expect(rows).toEqual([
      {
        month: '2026-07',
        entradas: 0,
        costoMercancia: 0,
        gastos: 0,
        ganancia: 0,
        margen: null,
        pctGastos: null,
        balance: 0,
      },
    ])
  })
})
