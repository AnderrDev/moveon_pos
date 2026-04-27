import { describe, it, expect } from 'vitest'
import { moneySchema, salePriceSchema } from '@/shared/validations/common'

/**
 * Tests del schema de moneda — la fuente de verdad de FormCurrencyInput.
 * Prueba el comportamiento del schema, no el componente React
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
