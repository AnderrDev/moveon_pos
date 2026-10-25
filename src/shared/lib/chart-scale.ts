/**
 * Escalas y formatos para las gráficas del design system (`shared/molecules/charts`).
 * Funciones puras.
 */

/** Marcas del eje con números redondos (1, 2, 2,5 o 5 × 10ⁿ), de 0 a ≥ `max`. */
export function niceTicks(max: number, target = 4): number[] {
  if (!Number.isFinite(max) || max <= 0) return [0, 1]
  const rough = max / target
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rough) ?? 10 * magnitude
  const ticks: number[] = []
  for (let v = 0; v < max + step * 1e-9; v += step) ticks.push(Math.round(v * 1e6) / 1e6)
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step)
  return ticks
}

function trim(n: number): string {
  return n.toLocaleString('es-CO', { maximumFractionDigits: n >= 10 ? 0 : 1 })
}

/** Pesos en corto para ejes y etiquetas: $850, $12 mil, $1,2 M, $15 M. */
export function compactMoney(value: number): string {
  const abs = Math.abs(value)
  const sign = value < 0 ? '−' : ''
  if (abs >= 1_000_000) return `${sign}$${trim(abs / 1_000_000)} M`
  if (abs >= 1_000) return `${sign}$${trim(abs / 1_000)} mil`
  return `${sign}$${Math.round(abs).toLocaleString('es-CO')}`
}

/** Cantidades en corto: 950, 1,2 mil. */
export function compactCount(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000) return `${value < 0 ? '−' : ''}${trim(abs / 1_000)} mil`
  return Math.round(value).toLocaleString('es-CO')
}

/** "<1" cuando la parte existe pero redondea a 0 (un 0% engaña). */
export function shareLabel(part: number, total: number): string {
  const pct = sharePct(part, total)
  return part > 0 && pct === 0 ? '<1' : String(pct)
}

/** Porcentaje de `part` sobre `total`, redondeado; 0 si no hay total. */
export function sharePct(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0
}
