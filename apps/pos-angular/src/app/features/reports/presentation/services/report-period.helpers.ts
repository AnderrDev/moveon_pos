/**
 * Lógica pura de fechas/presets para el módulo de reportes.
 *
 * TS puro, sin dependencias de Angular ni de Supabase — extraída de
 * `reportes.page.ts` (PLAN-33) para que sea testeable sin TestBed y para
 * que PLAN-38 ("tendencia por día") pueda extenderla sin tocar el componente.
 */

export type TabId = 'daily' | 'accounting' | 'loyalty' | 'stock'
export type Preset = 'today' | 'week' | 'month' | 'prev-month'
/** Sub-secciones del tab "Ventas" (`TabId === 'daily'`). */
export type SalesSubTabId = 'resumen' | 'productos' | 'cajeros' | 'ventas'
/** Filtro de estado para el listado de ventas en la sub-sección "Ventas". */
export type SalesStatusFilter = 'all' | 'completed' | 'voided'

/** Formatea `date` a `YYYY-MM-DD` en la zona horaria indicada. */
export function isoDate(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

// Toda la aritmética de estas funciones opera en UTC (`T00:00:00Z`, `Date.UTC`,
// `getUTC*`): las fechas `YYYY-MM-DD` son días calendario abstractos y el
// resultado no debe depender de la zona horaria del dispositivo.

/** Suma (o resta) `days` días a una fecha `YYYY-MM-DD`. */
export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Lunes de la semana ISO que contiene `iso`. */
export function weekStart(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  const day = d.getUTCDay() // 0=Dom
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  return d.toISOString().slice(0, 10)
}

/** Primer día del mes de `iso`. */
export function monthStart(iso: string): string {
  return iso.slice(0, 7) + '-01'
}

/** Último día del mes de `iso`. */
export function monthEnd(iso: string): string {
  const [y, m] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
}

/** Primer día del mes anterior al de `iso`. */
export function prevMonthStart(iso: string): string {
  const [y, m] = iso.split('-').map(Number)
  const prev = m === 1 ? Date.UTC(y - 1, 11, 1) : Date.UTC(y, m - 2, 1)
  return new Date(prev).toISOString().slice(0, 10)
}

/** Rango `[from, to]` resultante de aplicar un preset, tomando `today` como ancla. */
export interface PresetRange {
  from: string
  to: string
}

/**
 * Resuelve el rango `{ from, to }` para un preset dado. `today` DEBE ser la
 * fecha actual en la zona horaria de la tienda (`isoDate(new Date(), tz)`) —
 * anclar en otra fecha (p. ej. el `fromIso` vigente de la página) hace que los
 * presets se calculen relativos al período que se estaba viendo.
 */
export function resolvePreset(today: string, preset: Preset): PresetRange {
  switch (preset) {
    case 'today':
      return { from: today, to: today }
    case 'week':
      return { from: weekStart(today), to: today }
    case 'month':
      return { from: monthStart(today), to: today }
    case 'prev-month': {
      const pm = prevMonthStart(today)
      return { from: pm, to: monthEnd(pm) }
    }
  }
}
