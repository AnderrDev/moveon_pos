import { describe, expect, it } from 'vitest'
import { auditRangeStart } from '@angular-app/features/audit/presentation/services/audit-date-range'
import { shiftIsoDate, storeDateIso } from '@/shared/lib/day-range'

const BOGOTA = 'America/Bogota'
// 2026-10-25 02:30 UTC = 2026-10-24 21:30 en Bogotá (UTC−5).
const NOW = new Date('2026-10-25T02:30:00Z')

describe('fechas en la zona de la tienda', () => {
  it('storeDateIso usa la zona de la tienda, no la UTC', () => {
    expect(storeDateIso(NOW, BOGOTA)).toBe('2026-10-24')
    expect(storeDateIso(NOW, 'UTC')).toBe('2026-10-25')
  })

  it('shiftIsoDate cruza meses', () => {
    expect(shiftIsoDate('2026-03-01', -1)).toBe('2026-02-28')
    expect(shiftIsoDate('2026-10-24', -30)).toBe('2026-09-24')
  })
})

describe('auditRangeStart', () => {
  it('hoy = medianoche de la tienda aunque en UTC ya sea mañana', () => {
    expect(auditRangeStart('today', BOGOTA, NOW)?.toISOString()).toBe('2026-10-24T05:00:00.000Z')
  })

  it('semana y mes retroceden 7 y 30 días de la tienda', () => {
    expect(auditRangeStart('week', BOGOTA, NOW)?.toISOString()).toBe('2026-10-17T05:00:00.000Z')
    expect(auditRangeStart('month', BOGOTA, NOW)?.toISOString()).toBe('2026-09-24T05:00:00.000Z')
  })

  it('todo = sin límite', () => {
    expect(auditRangeStart('all', BOGOTA, NOW)).toBeUndefined()
  })
})
