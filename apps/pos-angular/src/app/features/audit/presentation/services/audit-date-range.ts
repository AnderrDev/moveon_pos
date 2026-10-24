import { getStoreDayRangeUtc, shiftIsoDate, storeDateIso } from '@/shared/lib/day-range'

export type AuditDateRange = 'today' | 'week' | 'month' | 'all'

const DAYS_BACK: Record<Exclude<AuditDateRange, 'all'>, number> = {
  today: 0,
  week: 7,
  month: 30,
}

/**
 * Inicio (UTC) del filtro de fechas de /auditoria: medianoche de la tienda
 * de hoy, de hace 7 o de hace 30 días. `undefined` = sin límite. Usa la zona
 * de la tienda, no la del dispositivo.
 */
export function auditRangeStart(range: AuditDateRange, timezone: string, now = new Date()): Date | undefined {
  if (range === 'all') return undefined
  const day = shiftIsoDate(storeDateIso(now, timezone), -DAYS_BACK[range])
  return getStoreDayRangeUtc(day, timezone).start
}
