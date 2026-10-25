import { shiftIsoDate } from '@/shared/lib/day-range'
import { getPaymentMethodLabel } from '@/shared/lib/payment-methods'
import type { ChartPoint } from '@angular-app/shared/molecules/charts/chart-palette'
import type {
  DailyPaymentBreakdown,
  DailyProductSale,
} from '@angular-app/features/reports/domain/entities/report.entity'
import type {
  DailySalesSummary,
  HourlySalesSummary,
} from '@angular-app/features/reports/domain/services/sales-trend'

/**
 * Puntos para las gráficas de Reportes (TS puro). Las gráficas muestran los
 * huecos: un día u hora sin ventas es un dato, así que se rellena con cero.
 */

const WEEKDAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function ventas(n: number): string {
  return `${n} ${n === 1 ? 'venta' : 'ventas'}`
}

function dayLabel(iso: string, spanDays: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  if (spanDays <= 14) return `${WEEKDAYS[date.getUTCDay()]} ${d}`
  return `${d} ${MONTHS[m - 1]}`
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000) + 1
}

/** Con más de esta cantidad de días se agrupa por semana. */
export const MAX_DAILY_COLUMNS = 45

/** Ventas por día del período (o por semana si el período es largo), con ceros. */
export function buildDailyPoints(daily: readonly DailySalesSummary[], fromIso: string, toIso: string): ChartPoint[] {
  const span = Math.max(1, daysBetween(fromIso, toIso))
  const byDay = new Map(daily.map((d) => [d.date, d]))

  if (span <= MAX_DAILY_COLUMNS) {
    return Array.from({ length: span }, (_, i) => {
      const iso = shiftIsoDate(fromIso, i)
      const d = byDay.get(iso)
      return { key: iso, label: dayLabel(iso, span), value: d?.total ?? 0, detail: ventas(d?.count ?? 0) }
    })
  }

  const points: ChartPoint[] = []
  for (let start = 0; start < span; start += 7) {
    const startIso = shiftIsoDate(fromIso, start)
    let total = 0
    let count = 0
    for (let i = start; i < Math.min(start + 7, span); i++) {
      const d = byDay.get(shiftIsoDate(fromIso, i))
      total += d?.total ?? 0
      count += d?.count ?? 0
    }
    points.push({ key: startIso, label: dayLabel(startIso, span), value: total, detail: `Semana · ${ventas(count)}` })
  }
  return points
}

function hourLabel(hour: number): string {
  if (hour === 0) return '12 a. m.'
  if (hour === 12) return '12 p. m.'
  return hour < 12 ? `${hour} a. m.` : `${hour - 12} p. m.`
}

/** Ventas por hora (suma del período), de 7 a. m. a 9 p. m. o lo que cubran los datos. */
export function buildHourlyPoints(hourly: readonly HourlySalesSummary[]): ChartPoint[] {
  const withSales = hourly.filter((h) => h.count > 0).map((h) => h.hour)
  const first = Math.min(7, ...withSales)
  const last = Math.max(21, ...withSales)
  const byHour = new Map(hourly.map((h) => [h.hour, h]))
  return Array.from({ length: last - first + 1 }, (_, i) => {
    const hour = first + i
    const h = byHour.get(hour)
    return { key: String(hour), label: hourLabel(hour), value: h?.total ?? 0, detail: ventas(h?.count ?? 0) }
  })
}

export function buildPaymentPoints(breakdown: readonly DailyPaymentBreakdown[]): ChartPoint[] {
  return breakdown
    .filter((p) => p.total > 0)
    .map((p) => ({ key: p.metodo, label: getPaymentMethodLabel(p.metodo), value: p.total, detail: ventas(p.count) }))
}

/** Los productos que más venden, por dinero. */
export function buildTopProductPoints(products: readonly DailyProductSale[], limit = 10): ChartPoint[] {
  return [...products]
    .filter((p) => p.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, limit)
    .map((p) => ({
      key: p.productId,
      label: p.nombre,
      value: p.total,
      detail: `${p.qty.toLocaleString('es-CO')} ${p.qty === 1 ? 'unidad' : 'unidades'}`,
    }))
}

/** Hora con más ventas (para el título "Tu mejor hora"). */
export function peakHour(hourly: readonly HourlySalesSummary[]): { label: string; total: number } | null {
  const best = [...hourly].sort((a, b) => b.total - a.total)[0]
  return best && best.total > 0 ? { label: hourLabel(best.hour), total: best.total } : null
}
