import { describe, it, expect } from 'vitest'
import {
  NEQUI_CARD_FEE,
  calculateCardCharge,
  calculateCardFee,
  cardSurchargePercent,
  formatCardSurchargePercent,
  validateCardChargeAmount,
  type CardFeeConfig,
  type CardFeeIvaBase,
  type CardFeeRounding,
} from '@angular-app/features/sales/domain/services/card-surcharge'

function config(rounding: CardFeeRounding, ivaBase: CardFeeIvaBase): CardFeeConfig {
  return { ...NEQUI_CARD_FEE, rounding, ivaBase }
}

/**
 * Costo esperado por regla para los montos que las distinguen (calculado aparte
 * con aritmética decimal exacta). Todas dan $36 en la prueba real de $1.500.
 */
const FEE_BY_RULE: Array<[CardFeeRounding, CardFeeIvaBase, Record<number, number>]> = [
  ['half-up', 'rounded-commission', { 1500: 36, 1558: 37, 1626: 38, 1732: 40, 15000: 356 }],
  ['half-even', 'rounded-commission', { 1500: 36, 1558: 37, 1626: 38, 1732: 40, 15000: 355 }],
  ['ceil', 'rounded-commission', { 1500: 36, 1558: 39, 1626: 40, 1732: 42, 15000: 356 }],
  ['half-up', 'exact-commission', { 1500: 36, 1558: 37, 1626: 38, 1732: 41, 15000: 356 }],
  ['half-even', 'exact-commission', { 1500: 36, 1558: 37, 1626: 38, 1732: 41, 15000: 355 }],
  ['ceil', 'exact-commission', { 1500: 36, 1558: 38, 1626: 40, 1732: 42, 15000: 356 }],
  ['half-up', 'single-rounding', { 1500: 36, 1558: 37, 1626: 39, 1732: 41, 15000: 355 }],
  ['ceil', 'single-rounding', { 1500: 36, 1558: 37, 1626: 39, 1732: 42, 15000: 356 }],
]

describe('calculateCardFee', () => {
  it('replica la prueba real en Nequi: $1.500 deja $36 de costo y $1.464 neto', () => {
    expect(calculateCardFee(1500)).toEqual({ commission: 30, iva: 6, fee: 36, net: 1464 })
  })

  it('calcula el ejemplo oficial de $30.000 (comisión $597 + IVA $113)', () => {
    const result = calculateCardFee(30000)
    expect(result.commission).toBe(597)
    expect(result.iva).toBe(113)
    expect(result.net).toBe(29290)
  })

  it.each(FEE_BY_RULE)('regla %s / %s da el costo esperado', (rounding, ivaBase, expected) => {
    for (const [amount, fee] of Object.entries(expected)) {
      expect(calculateCardFee(Number(amount), config(rounding, ivaBase)).fee).toBe(fee)
    }
  })
})

describe('calculateCardCharge', () => {
  it('suma el recargo para que a la cuenta llegue exacto el valor de la venta', () => {
    const charge = calculateCardCharge(30000)
    expect(charge.chargeAmount).toBe(30727)
    expect(charge.surcharge).toBe(727)
    expect(calculateCardFee(charge.chargeAmount).net).toBe(30000)
  })

  it('con la regla por defecto el neto es exacto y el cobro es el mínimo en todo el rango', () => {
    for (let base = 1500; base <= 244000; base += 1) {
      const { chargeAmount } = calculateCardCharge(base)
      expect(calculateCardFee(chargeAmount).net).toBe(base)
      expect(calculateCardFee(chargeAmount - 1).net).toBeLessThan(base)
    }
  })

  it.each(FEE_BY_RULE)('con la regla %s / %s el neto también es exacto', (rounding, ivaBase) => {
    const rule = config(rounding, ivaBase)
    for (let base = 1500; base <= 244000; base += 13) {
      const { chargeAmount } = calculateCardCharge(base, rule)
      expect(calculateCardFee(chargeAmount, rule).net).toBe(base)
    }
  })

  it('una venta en $0 no genera recargo', () => {
    expect(calculateCardCharge(0)).toEqual({ baseAmount: 0, chargeAmount: 0, surcharge: 0 })
  })
})

describe('validateCardChargeAmount', () => {
  it('respeta los límites por transacción', () => {
    expect(validateCardChargeAmount(1499)).not.toBeNull()
    expect(validateCardChargeAmount(1500)).toBeNull()
    expect(validateCardChargeAmount(250000)).toBeNull()
    expect(validateCardChargeAmount(250001)).not.toBeNull()
  })
})

describe('cardSurchargePercent', () => {
  it('con 1,99 % + IVA el recargo es 2,43 % de la venta', () => {
    expect(cardSurchargePercent({ rateBps: 199, ivaPct: 19 })).toBeCloseTo(2.4255, 4)
    expect(formatCardSurchargePercent({ rateBps: 199, ivaPct: 19 })).toBe('2,43 %')
  })

  it('el % coincide con el recargo real de una venta grande', () => {
    const { surcharge } = calculateCardCharge(200000)
    expect((surcharge / 200000) * 100).toBeCloseTo(cardSurchargePercent({ rateBps: 199, ivaPct: 19 }), 2)
  })

  it('cambia con la tarifa de la tienda', () => {
    expect(formatCardSurchargePercent({ rateBps: 250, ivaPct: 19 })).toBe('3,07 %')
  })
})
