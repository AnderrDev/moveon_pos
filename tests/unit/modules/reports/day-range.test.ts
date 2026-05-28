import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TIMEZONE,
  getStoreDayRangeUtc,
} from '@/modules/reports/domain/services/day-range'

// Colombia (America/Bogota) no observa DST: offset fijo −5 todo el año.
describe('getStoreDayRangeUtc', () => {
  it('mapea 2026-05-27 en America/Bogota a [05:00Z, día+1 05:00Z)', () => {
    const { start, end } = getStoreDayRangeUtc('2026-05-27', 'America/Bogota')
    expect(start.toISOString()).toBe('2026-05-27T05:00:00.000Z')
    expect(end.toISOString()).toBe('2026-05-28T05:00:00.000Z')
  })

  it('incluye el borde 00:00 local (>= start)', () => {
    const { start } = getStoreDayRangeUtc('2026-05-27', 'America/Bogota')
    const localMidnight = new Date('2026-05-27T05:00:00.000Z')
    expect(localMidnight.getTime()).toBeGreaterThanOrEqual(start.getTime())
  })

  it('incluye el borde 23:59:59.999 local (< end)', () => {
    const { end } = getStoreDayRangeUtc('2026-05-27', 'America/Bogota')
    const lastLocalMs = new Date('2026-05-28T04:59:59.999Z')
    expect(lastLocalMs.getTime()).toBeLessThan(end.getTime())
  })

  it('excluye 00:00 del día siguiente local (>= end)', () => {
    const { end } = getStoreDayRangeUtc('2026-05-27', 'America/Bogota')
    const nextLocalMidnight = new Date('2026-05-28T05:00:00.000Z')
    expect(nextLocalMidnight.getTime()).toBeGreaterThanOrEqual(end.getTime())
  })

  it('venta 23:30 hora Bogotá del 27 (04:30Z del 28) cae en el rango del 27', () => {
    const { start, end } = getStoreDayRangeUtc('2026-05-27', 'America/Bogota')
    const venta = new Date('2026-05-28T04:30:00.000Z')
    expect(venta.getTime()).toBeGreaterThanOrEqual(start.getTime())
    expect(venta.getTime()).toBeLessThan(end.getTime())
  })

  it('el rango dura exactamente 24h (86_400_000 ms)', () => {
    const { start, end } = getStoreDayRangeUtc('2026-05-27', 'America/Bogota')
    expect(end.getTime() - start.getTime()).toBe(86_400_000)
  })

  it('DEFAULT_TIMEZONE es America/Bogota', () => {
    expect(DEFAULT_TIMEZONE).toBe('America/Bogota')
    const a = getStoreDayRangeUtc('2026-05-27', DEFAULT_TIMEZONE)
    const b = getStoreDayRangeUtc('2026-05-27', 'America/Bogota')
    expect(a.start.toISOString()).toBe(b.start.toISOString())
    expect(a.end.toISOString()).toBe(b.end.toISOString())
  })

  it('UTC produce un rango [00:00Z, día+1 00:00Z)', () => {
    const { start, end } = getStoreDayRangeUtc('2026-05-27', 'UTC')
    expect(start.toISOString()).toBe('2026-05-27T00:00:00.000Z')
    expect(end.toISOString()).toBe('2026-05-28T00:00:00.000Z')
  })
})
