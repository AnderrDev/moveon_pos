import { describe, expect, it } from 'vitest'
import { formatCurrency, formatShortDate, formatTime } from '@/shared/lib/format'

describe('formatCurrency', () => {
  it('formatea pesos colombianos sin decimales', () => {
    expect(formatCurrency(123456)).toBe('$ 123.456')
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
