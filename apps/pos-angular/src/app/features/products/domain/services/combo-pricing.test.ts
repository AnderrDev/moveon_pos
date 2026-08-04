import { describe, expect, it } from 'vitest'
import {
  comboSavings,
  sumComboItemCost,
  sumComboItemPrice,
  type ComboItemPricing,
} from '@angular-app/features/products/domain/services/combo-pricing'

/** Proteína $180.000 (costo $120.000) + shaker $35.000 (costo $18.000). */
const PROTEINA_MAS_SHAKER: ComboItemPricing[] = [
  { cantidad: 1, precioVenta: 180000, costo: 120000 },
  { cantidad: 1, precioVenta: 35000, costo: 18000 },
]

describe('sumComboItemPrice', () => {
  it('suma el precio de lista de los productos incluidos', () => {
    expect(sumComboItemPrice(PROTEINA_MAS_SHAKER)).toBe(215000)
  })

  it('multiplica por la cantidad de cada producto', () => {
    expect(sumComboItemPrice([{ cantidad: 3, precioVenta: 8000, costo: null }])).toBe(24000)
  })

  it('devuelve 0 sin productos incluidos', () => {
    expect(sumComboItemPrice([])).toBe(0)
  })
})

describe('sumComboItemCost', () => {
  it('suma el costo de los productos incluidos', () => {
    expect(sumComboItemCost(PROTEINA_MAS_SHAKER)).toBe(138000)
  })

  it('cuenta como 0 los productos sin costo registrado', () => {
    expect(
      sumComboItemCost([
        { cantidad: 1, precioVenta: 180000, costo: 120000 },
        { cantidad: 2, precioVenta: 35000, costo: null },
      ]),
    ).toBe(120000)
  })
})

describe('comboSavings', () => {
  it('calcula el ahorro y el porcentaje frente a comprar por separado', () => {
    const { sumaNormal, ahorro, porcentaje } = comboSavings(190000, PROTEINA_MAS_SHAKER)

    expect(sumaNormal).toBe(215000)
    expect(ahorro).toBe(25000)
    expect(porcentaje).toBe(11.6)
  })

  it('no reporta ahorro negativo cuando el combo cuesta más que la suma', () => {
    expect(comboSavings(250000, PROTEINA_MAS_SHAKER)).toEqual({
      sumaNormal: 215000,
      ahorro: 0,
      porcentaje: 0,
    })
  })

  it('no reporta ahorro cuando el combo vale exactamente la suma', () => {
    expect(comboSavings(215000, PROTEINA_MAS_SHAKER).ahorro).toBe(0)
  })

  it('evita dividir por cero cuando no hay productos incluidos', () => {
    expect(comboSavings(100000, [])).toEqual({ sumaNormal: 0, ahorro: 0, porcentaje: 0 })
  })

  it('reporta 100% cuando el combo se regala', () => {
    expect(comboSavings(0, PROTEINA_MAS_SHAKER).porcentaje).toBe(100)
  })
})
