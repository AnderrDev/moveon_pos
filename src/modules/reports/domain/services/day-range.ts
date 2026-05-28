/**
 * Servicio de dominio puro (TS, sin Angular/Supabase/DOM).
 *
 * Calcula los límites UTC del día calendario de la tienda en su zona horaria
 * local. Usado por el reporte diario para filtrar ventas y sesiones por el día
 * local en lugar del día UTC (una venta a las 23:30 hora Colombia pertenece a
 * ESE día local, no al siguiente día UTC).
 *
 * Solo depende de `Intl`, que es estándar de JS — no introduce dependencias.
 */

/** Zona horaria por defecto (tienda única en Colombia, UTC−5, sin DST). */
export const DEFAULT_TIMEZONE = 'America/Bogota'

/** Rango semiabierto `[start, end)` en UTC. */
export interface DayRangeUtc {
  start: Date
  end: Date
}

const MS_PER_MINUTE = 60_000

/**
 * Devuelve el offset (en minutos) de la zona horaria `timezone` para el
 * instante `date`. Positivo cuando la hora local va por delante de UTC.
 *
 * Se deriva vía `Intl.DateTimeFormat`/`formatToParts` reconstruyendo el
 * instante local "como si fuese UTC" y comparándolo con el instante real.
 * Esto evita hardcodear el offset y respeta zonas con DST.
 */
function getTimezoneOffsetMinutes(date: Date, timezone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  const parts = dtf.formatToParts(date)
  const lookup = (type: Intl.DateTimeFormatPartTypes): number => {
    const part = parts.find((p) => p.type === type)
    return part ? Number(part.value) : 0
  }

  // `Intl` rinde la hora 24 como 0 en algunos runtimes; normalizamos.
  const hour = lookup('hour') % 24

  const asUtc = Date.UTC(
    lookup('year'),
    lookup('month') - 1,
    lookup('day'),
    hour,
    lookup('minute'),
    lookup('second'),
  )

  return Math.round((asUtc - date.getTime()) / MS_PER_MINUTE)
}

/**
 * Dada una fecha calendario `YYYY-MM-DD` y una zona horaria, devuelve los
 * límites UTC del rango semiabierto `[día 00:00 local, día+1 00:00 local)`.
 *
 * @param dateIso  Fecha calendario en formato `YYYY-MM-DD` (día local).
 * @param timezone Zona horaria IANA (ej. `America/Bogota`).
 */
export function getStoreDayRangeUtc(dateIso: string, timezone: string): DayRangeUtc {
  const [year, month, day] = dateIso.split('-').map(Number)

  // Instante "ingenuo": medianoche local interpretada como si fuese UTC.
  const naiveMidnightUtc = Date.UTC(year, month - 1, day, 0, 0, 0, 0)

  // El offset puede variar según el instante (DST), así que lo evaluamos
  // sobre el instante ingenuo para corregir hacia el UTC real de la medianoche.
  const offsetMinutes = getTimezoneOffsetMinutes(new Date(naiveMidnightUtc), timezone)

  const start = new Date(naiveMidnightUtc - offsetMinutes * MS_PER_MINUTE)
  const end = new Date(start.getTime() + 24 * 60 * MS_PER_MINUTE)

  return { start, end }
}
