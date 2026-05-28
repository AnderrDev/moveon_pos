import { describe, it, expect } from 'vitest'
import { moneySchema, salePriceSchema } from '@/shared/validations/common'
import { clampCurrency, parseCurrency } from '@/shared/lib/format'

/**
 * Replica exactamente la normalización del componente (`commit()`):
 * parsea cualquier representación del DOM/portapapeles a un entero y la
 * restringe al rango [min, max]. Se prueba como función pura porque vitest
 * corre en node sin jsdom, así que no se monta el componente Angular.
 */
function normalizeCurrencyInput(raw: string, min = 0, max = 100_000_000): number {
  return clampCurrency(parseCurrency(raw), min, max)
}

/**
 * Normalización de entrada del FormCurrencyInput.
 * Equivale a lo que hace el componente cuando llega input/paste/fill,
 * sin renderizar Angular (vitest corre en node sin jsdom).
 */
describe('FormCurrencyInput · normalización de entrada', () => {
  it('fill("2533560") produce 2533560 (no topa al máximo)', () => {
    expect(normalizeCurrencyInput('2533560')).toBe(2533560)
  })

  it('paste de un display formateado produce el entero limpio', () => {
    expect(normalizeCurrencyInput('$ 2.533.560')).toBe(2533560)
  })

  it('topa al máximo por defecto cuando el valor lo excede', () => {
    expect(normalizeCurrencyInput('150000000')).toBe(100_000_000)
  })

  it('topa al máximo custom (item-discount con [max]=unitPrice)', () => {
    expect(normalizeCurrencyInput('2533560', 0, 3000)).toBe(3000)
  })

  it('eleva al mínimo cuando el valor es menor', () => {
    expect(normalizeCurrencyInput('500', 1000)).toBe(1000)
  })

  it('entrada vacía produce 0 (sin residuo)', () => {
    expect(normalizeCurrencyInput('')).toBe(0)
  })

  it('entrada no numérica produce 0', () => {
    expect(normalizeCurrencyInput('abc')).toBe(0)
  })
})

/**
 * Tests del schema de moneda — la fuente de verdad de FormCurrencyInput.
 * Prueba el comportamiento del schema, no el componente Angular
 * (los tests de componentes requieren jsdom configurado).
 */
describe('moneySchema', () => {
  it('acepta cero', () => {
    expect(moneySchema.safeParse(0).success).toBe(true)
  })

  it('acepta valores positivos enteros', () => {
    expect(moneySchema.safeParse(25_000).success).toBe(true)
    expect(moneySchema.safeParse(1_500_000).success).toBe(true)
  })

  it('rechaza valores negativos', () => {
    const result = moneySchema.safeParse(-1)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/negativo/)
    }
  })

  it('rechaza decimales', () => {
    const result = moneySchema.safeParse(1500.50)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/centavos/)
    }
  })

  it('rechaza valores superiores al máximo', () => {
    const result = moneySchema.safeParse(100_000_001)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/alto/)
    }
  })

  it('rechaza strings', () => {
    const result = moneySchema.safeParse('25000')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/numérico/)
    }
  })
})

describe('salePriceSchema', () => {
  it('rechaza cero como precio de venta', () => {
    const result = salePriceSchema.safeParse(0)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/mayor/)
    }
  })

  it('acepta cualquier valor positivo entero', () => {
    expect(salePriceSchema.safeParse(1).success).toBe(true)
    expect(salePriceSchema.safeParse(50_000).success).toBe(true)
  })
})
