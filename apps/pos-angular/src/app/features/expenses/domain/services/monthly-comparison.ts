export interface MonthlyComparisonRow {
  /** `YYYY-MM` local. */
  month: string
  entradas: number
  /** Lo que costó la mercancía vendida en el mes (Σ cantidad × costo de cada línea con costo). */
  costoMercancia: number
  gastos: number
  /** Entradas − costo de la mercancía vendida − gastos: la misma ganancia del resumen del mes. */
  ganancia: number
  /** % de la ganancia sobre las entradas. `null` si no hubo entradas. */
  margen: number | null
  /** % de gastos sobre entradas. `null` si no hubo entradas. Paridad con `owner_finance_summary` (iOS). */
  pctGastos: number | null
  /** Entradas − gastos, sin la mercancía. Paridad con `owner_finance_summary` (iOS); el web ya no lo muestra. */
  balance: number
}

export interface MonthlyTotal {
  /** `YYYY-MM`. */
  month: string
  total: number
}

export interface MonthlyComparisonInput {
  /**
   * Totales ya agregados por mes en el servidor (RPCs get_monthly_*_totals).
   * Nunca filas crudas: sumar en el cliente trunca en el límite de 1000
   * filas de PostgREST (bug 2026-07-21).
   */
  entradas: readonly MonthlyTotal[]
  gastos: readonly MonthlyTotal[]
  /** Costo de la mercancía vendida por mes. Sin dato para un mes, cuenta 0. */
  costoMercancia?: readonly MonthlyTotal[]
  /** Meses a mostrar, en orden (`YYYY-MM`). */
  months: readonly string[]
}

function pctOf(part: number, total: number): number | null {
  return total > 0 ? Math.round((part / total) * 1000) / 10 : null
}

/** Últimos `n` meses locales terminando en `now`, en orden ascendente. */
export function lastMonths(n: number, now: Date = new Date()): string[] {
  const months: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return months
}

/** Tendencia mensual: ventas, mercancía vendida, gastos y ganancia. Función pura. */
export function buildMonthlyComparison(input: MonthlyComparisonInput): MonthlyComparisonRow[] {
  const entradasByMonth = new Map(input.entradas.map((e) => [e.month, e.total]))
  const gastosByMonth = new Map(input.gastos.map((g) => [g.month, g.total]))
  const costoByMonth = new Map((input.costoMercancia ?? []).map((c) => [c.month, c.total]))

  return input.months.map((month) => {
    const entradas = entradasByMonth.get(month) ?? 0
    const gastos = gastosByMonth.get(month) ?? 0
    const costoMercancia = costoByMonth.get(month) ?? 0
    const ganancia = entradas - costoMercancia - gastos
    return {
      month,
      entradas,
      costoMercancia,
      gastos,
      ganancia,
      margen: pctOf(ganancia, entradas),
      pctGastos: pctOf(gastos, entradas),
      balance: entradas - gastos,
    }
  })
}
