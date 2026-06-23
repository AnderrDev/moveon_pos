/**
 * Servicio de dominio puro (TS, sin Angular/Supabase/DOM).
 *
 * Agrupa las ventas del período por hora local del día y por día calendario
 * local, para la sección "Tendencia" del reporte de ventas (PLAN-38). SRP
 * estricto: solo agrupa y agrega; NO formatea moneda ni etiquetas — eso es
 * responsabilidad de la capa de presentación.
 *
 * Solo depende del tipo `Sale` del dominio de ventas y de `Intl` (estándar de
 * JS) — no introduce dependencias. Usa `Intl.DateTimeFormat` con `timeZone`
 * explícito (igual que `day-range.ts`) para leer la hora/fecha LOCAL de la
 * tienda a partir de `sale.createdAt` (UTC); nunca `getHours()`/
 * `getUTCHours()`/`toLocaleTimeString()` sin `timeZone`, que dependerían de
 * la zona horaria del runtime (navegador/CI) en vez de la de la tienda.
 */

import type { Sale } from '@/modules/sales/domain/entities/sale.entity'

/** Resumen agregado de ventas completadas de una hora local del período. */
export interface HourlySalesSummary {
  /** Hora local `0..23`. */
  hour: number
  /** Cantidad de ventas completadas en esa hora (sumadas entre todos los días del período). */
  count: number
  /** Total vendido (solo ventas completadas). */
  total: number
  /** Ticket promedio (`total / count`, redondeado al peso más cercano). */
  avgTicket: number
}

/** Resumen agregado de ventas completadas de un día calendario local. */
export interface DailySalesSummary {
  /** Día calendario local en formato `YYYY-MM-DD`. */
  date: string
  /** Cantidad de ventas completadas ese día. */
  count: number
  /** Total vendido (solo ventas completadas). */
  total: number
  /** Ticket promedio (`total / count`, redondeado al peso más cercano). */
  avgTicket: number
}

/** Formatea `date` a la hora local `0..23` en `timezone`, vía `Intl`. */
function localHour(date: Date, timezone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour12: false,
    hour: '2-digit',
  })
  const part = dtf.formatToParts(date).find((p) => p.type === 'hour')
  // `Intl` rinde la hora 24 como 0 en algunos runtimes; normalizamos.
  return part ? Number(part.value) % 24 : 0
}

/** Formatea `date` a `YYYY-MM-DD` en `timezone`, vía `Intl` (mismo patrón que `isoDate` de `report-period.helpers.ts`, reimplementado aquí porque ese archivo es de la capa Angular-feature, no de dominio). */
function localDateIso(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

/**
 * Agrupa las ventas completadas del período por hora local `0..23`,
 * sumando entre todos los días del período (la hora 9 acumula las ventas de
 * las 9am de cada día). Las ventas anuladas se excluyen por completo: no
 * generan fila ni aportan a `count`/`total` de ninguna hora.
 *
 * Solo se emite una fila por hora con al menos una venta completada — no se
 * rellenan las 24 horas (ver PLAN-38, decisión documentada en el spec de
 * sesión: el padding no aporta valor a un reporte tabular de "qué pasó" y
 * forzaría a depender de `report-period.helpers.ts`, que es capa Angular).
 *
 * Orden ascendente por hora.
 *
 * @param sales Ventas del período (completadas y anuladas).
 * @param timezone Zona horaria IANA de la tienda (ej. `America/Bogota`).
 */
export function groupSalesByLocalHour(sales: Sale[], timezone: string): HourlySalesSummary[] {
  const byHour = new Map<number, { count: number; total: number }>()

  for (const sale of sales) {
    if (sale.status !== 'completed') continue

    const hour = localHour(sale.createdAt, timezone)
    const current = byHour.get(hour) ?? { count: 0, total: 0 }
    current.count += 1
    current.total += sale.total
    byHour.set(hour, current)
  }

  return Array.from(byHour.entries())
    .map(([hour, v]) => ({
      hour,
      count: v.count,
      total: v.total,
      avgTicket: v.count > 0 ? Math.round(v.total / v.count) : 0,
    }))
    .sort((a, b) => a.hour - b.hour)
}

/**
 * Agrupa las ventas completadas del período por día calendario local
 * (`YYYY-MM-DD`). Las ventas anuladas se excluyen por completo: no generan
 * fila ni aportan a `count`/`total` de ningún día.
 *
 * Solo se emite una fila por día con al menos una venta completada — no se
 * rellenan los días sin ventas (ver PLAN-38, misma decisión que
 * `groupSalesByLocalHour`).
 *
 * Orden ascendente por fecha (comparación de string `YYYY-MM-DD`, que ya es
 * orden cronológico).
 *
 * @param sales Ventas del período (completadas y anuladas).
 * @param timezone Zona horaria IANA de la tienda (ej. `America/Bogota`).
 */
export function groupSalesByLocalDay(sales: Sale[], timezone: string): DailySalesSummary[] {
  const byDay = new Map<string, { count: number; total: number }>()

  for (const sale of sales) {
    if (sale.status !== 'completed') continue

    const date = localDateIso(sale.createdAt, timezone)
    const current = byDay.get(date) ?? { count: 0, total: 0 }
    current.count += 1
    current.total += sale.total
    byDay.set(date, current)
  }

  return Array.from(byDay.entries())
    .map(([date, v]) => ({
      date,
      count: v.count,
      total: v.total,
      avgTicket: v.count > 0 ? Math.round(v.total / v.count) : 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
}
