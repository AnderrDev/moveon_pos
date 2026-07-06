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

export interface MonthlyComparisonInput {
  /** Ventas completadas: total y fecha local de creación. */
  sales: readonly { total: number; createdAt: Date }[]
  /** Gastos con su fecha contable `YYYY-MM-DD`; los anulados se ignoran. */
  gastos: readonly { monto: number; fechaGasto: string; status: string }[]
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

function monthOfDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/** Tendencia mensual de entradas vs. gastos. Función pura. */
export function buildMonthlyComparison(input: MonthlyComparisonInput): MonthlyComparisonRow[] {
  const entradasByMonth = new Map<string, number>()
  for (const sale of input.sales) {
    const month = monthOfDate(sale.createdAt)
    entradasByMonth.set(month, (entradasByMonth.get(month) ?? 0) + sale.total)
  }

  const gastosByMonth = new Map<string, number>()
  for (const gasto of input.gastos) {
    if (gasto.status !== 'active') continue
    const month = gasto.fechaGasto.slice(0, 7)
    gastosByMonth.set(month, (gastosByMonth.get(month) ?? 0) + gasto.monto)
  }

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
