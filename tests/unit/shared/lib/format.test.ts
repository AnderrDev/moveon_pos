import { describe, expect, it } from 'vitest'
import {
  clampCurrency,
  formatCurrency,
  formatShortDate,
  formatTime,
  parseCurrency,
} from '@/shared/lib/format'

describe('formatCurrency', () => {
  it('formatea pesos colombianos sin decimales', () => {
    expect(formatCurrency(123456)).toBe('$ 123.456')
  })
})

describe('parseCurrency', () => {
  it('parsea una cadena de dígitos plana', () => {
    expect(parseCurrency('2533560')).toBe(2533560)
  })

  it('parsea un display con símbolo y separadores de miles', () => {
    expect(parseCurrency('$ 2.533.560')).toBe(2533560)
  })

  it('parsea solo separadores de miles', () => {
    expect(parseCurrency('2.533.560')).toBe(2533560)
  })

  it('parsea un valor pequeño', () => {
    expect(parseCurrency('25000')).toBe(25000)
  })

  it('devuelve 0 para cadena vacía', () => {
    expect(parseCurrency('')).toBe(0)
  })

  it('devuelve 0 para texto no numérico', () => {
    expect(parseCurrency('abc')).toBe(0)
  })

  it('parsea el cero literal', () => {
    expect(parseCurrency('0')).toBe(0)
  })

  it('nunca devuelve NaN', () => {
    expect(Number.isNaN(parseCurrency(''))).toBe(false)
    expect(Number.isNaN(parseCurrency('abc'))).toBe(false)
    expect(Number.isNaN(parseCurrency('$ -'))).toBe(false)
  })

  it('hace round-trip con formatCurrency', () => {
    expect(parseCurrency(formatCurrency(2533560))).toBe(2533560)
  })

  it('elimina el NBSP que produce Intl es-CO', () => {
    // Intl es-CO separa el simbolo con un espacio NBSP, no ASCII.
    const formatted = formatCurrency(1500000)
    expect(parseCurrency(formatted)).toBe(1500000)
  })
})

describe('clampCurrency', () => {
  it('deja el valor intacto dentro del rango', () => {
    expect(clampCurrency(5000, 0, 100_000_000)).toBe(5000)
  })

  it('topa al maximo cuando excede', () => {
    expect(clampCurrency(150_000_000, 0, 100_000_000)).toBe(100_000_000)
  })

  it('topa al maximo respetando un max custom (item-discount)', () => {
    expect(clampCurrency(2533560, 0, 3000)).toBe(3000)
  })

  it('eleva al minimo cuando es menor', () => {
    expect(clampCurrency(-50, 0, 100_000_000)).toBe(0)
  })

  it('respeta un minimo distinto de cero', () => {
    expect(clampCurrency(500, 1000, 100_000_000)).toBe(1000)
  })
})

describe('formatTime', () => {
  it('formatea hora y minutos por defecto', () => {
    expect(formatTime(new Date('2026-04-27T15:04:05-05:00'))).toMatch(/03:04/)
  })

  it('permite incluir segundos', () => {
    expect(formatTime(new Date('2026-04-27T15:04:05-05:00'), { second: '2-digit' })).toMatch(/03:04:05/)
  })

  it('acepta fechas como string', () => {
    expect(formatTime('2026-04-27T15:04:05-05:00')).toMatch(/03:04/)
  })
})

describe('formatShortDate', () => {
  it('formatea fecha corta colombiana', () => {
    expect(formatShortDate(new Date('2026-04-27T12:00:00-05:00'))).toContain('27')
  })

  it('acepta fechas cortas como string', () => {
    expect(formatShortDate('2026-04-27T12:00:00-05:00')).toContain('27')
  })
})
