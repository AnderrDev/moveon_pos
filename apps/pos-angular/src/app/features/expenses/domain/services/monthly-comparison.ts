export interface MonthlyComparisonRow {
  /** `YYYY-MM` local. */
  month: string
  entradas: number
  gastos: number
  /** % de gastos sobre entradas. `null` si no hubo entradas. */
  pctGastos: number | null
  /** Entradas − gastos (no descuenta costo de productos — ver nota en la UI). */
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
  /** Meses a mostrar, en orden (`YYYY-MM`). */
  months: readonly string[]
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

/** Tendencia mensual de entradas vs. gastos. Función pura. */
export function buildMonthlyComparison(input: MonthlyComparisonInput): MonthlyComparisonRow[] {
  const entradasByMonth = new Map(input.entradas.map((e) => [e.month, e.total]))
  const gastosByMonth = new Map(input.gastos.map((g) => [g.month, g.total]))

  return input.months.map((month) => {
    const entradas = entradasByMonth.get(month) ?? 0
    const gastos = gastosByMonth.get(month) ?? 0
    return {
      month,
      entradas,
      gastos,
      pctGastos: entradas > 0 ? Math.round((gastos / entradas) * 1000) / 10 : null,
      balance: entradas - gastos,
    }
  })
}
