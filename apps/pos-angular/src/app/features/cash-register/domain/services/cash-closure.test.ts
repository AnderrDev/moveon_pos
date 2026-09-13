import { describe, expect, it } from 'vitest'
import {
  CASH_DIFFERENCE_THRESHOLD,
  computeCashTurnSummary,
  computeClosingWithdrawal,
  computeMethodDifference,
  exceedsThreshold,
  isBalanced,
} from '@angular-app/features/cash-register/domain/services/cash-closure'

describe('computeCashTurnSummary', () => {
  it('separa los movimientos activos y calcula el efectivo esperado', () => {
    const summary = computeCashTurnSummary(100_000, 250_000, [
      { tipo: 'cash_in', amount: 30_000, status: 'active' },
      { tipo: 'expense', amount: 10_000, status: 'active' },
      { tipo: 'cash_out', amount: 40_000, status: 'active' },
      { tipo: 'correction', amount: 5_000, status: 'active' },
      { tipo: 'cash_in', amount: 999_000, status: 'voided' },
    ])

    expect(summary).toEqual({
      openingAmount: 100_000,
      cashSalesAmount: 250_000,
      cashInAmount: 30_000,
      expenseAmount: 10_000,
      cashOutAmount: 40_000,
      correctionAmount: 5_000,
      movementsTotal: -25_000,
      expectedCashAmount: 325_000,
    })
  })
})

describe('computeClosingWithdrawal', () => {
  it('calcula el retiro como efectivo contado menos efectivo dejado', () => {
    expect(computeClosingWithdrawal(480_000, 150_000)).toBe(330_000)
  })

  it('devuelve cero cuando todo el efectivo contado queda en caja', () => {
    expect(computeClosingWithdrawal(150_000, 150_000)).toBe(0)
  })
})

describe('computeMethodDifference', () => {
  it('devuelve 0 cuando el conteo coincide con lo esperado', () => {
    expect(computeMethodDifference(2533560, 2533560)).toBe(0)
  })

  it('devuelve diferencia positiva cuando el conteo supera lo esperado (sobra)', () => {
    expect(computeMethodDifference(100000, 120000)).toBe(20000)
  })

  it('devuelve diferencia negativa cuando el conteo no llega a lo esperado (falta)', () => {
    expect(computeMethodDifference(120000, 100000)).toBe(-20000)
  })

  it('devuelve 0 cuando esperado y conteo son ambos 0', () => {
    expect(computeMethodDifference(0, 0)).toBe(0)
  })
})

describe('isBalanced', () => {
  it('es verdadero solo cuando la diferencia es exactamente 0', () => {
    expect(isBalanced(0)).toBe(true)
    expect(isBalanced(1)).toBe(false)
    expect(isBalanced(-1)).toBe(false)
  })
})

describe('exceedsThreshold', () => {
  it('expone el umbral de $5.000', () => {
    expect(CASH_DIFFERENCE_THRESHOLD).toBe(5000)
  })

  it('no exige nota en el umbral exacto (positivo o negativo)', () => {
    expect(exceedsThreshold(CASH_DIFFERENCE_THRESHOLD)).toBe(false)
    expect(exceedsThreshold(-CASH_DIFFERENCE_THRESHOLD)).toBe(false)
  })

  it('exige nota cuando la diferencia absoluta supera el umbral (sobra)', () => {
    expect(exceedsThreshold(CASH_DIFFERENCE_THRESHOLD + 1)).toBe(true)
  })

  it('exige nota cuando la diferencia absoluta supera el umbral (falta)', () => {
    expect(exceedsThreshold(-(CASH_DIFFERENCE_THRESHOLD + 1))).toBe(true)
  })

  it('respeta un umbral personalizado', () => {
    expect(exceedsThreshold(150, 100)).toBe(true)
    expect(exceedsThreshold(100, 100)).toBe(false)
  })
})
