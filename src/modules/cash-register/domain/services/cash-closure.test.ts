import { describe, expect, it } from 'vitest'
import {
  CASH_DIFFERENCE_THRESHOLD,
  computeMethodDifference,
  exceedsThreshold,
  isBalanced,
} from './cash-closure'

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
