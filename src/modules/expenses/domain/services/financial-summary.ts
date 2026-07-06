import type { Expense, ExpenseCategory } from '../entities/expense.entity'

export interface FinancialSummaryInput {
  /** Total de ventas completadas del período (entradas totales). */
  entradasTotales: number
  /**
   * Costo de los productos vendidos en el período (utilidad bruta de reportes).
   * `null` cuando ningún producto tiene costo capturado — se muestra "—" y
   * la utilidad neta se calcula sin este componente.
   */
  costoProductosVendidos: number | null
  /** Gastos del período; los anulados se ignoran. */
  gastos: readonly Expense[]
  categorias: readonly ExpenseCategory[]
}

export interface CategoryExpenseSummary {
  categoryId: string
  nombre: string
  total: number
  /** % del total de la categoría sobre las entradas. `null` si no hay entradas. */
  pctSobreEntradas: number | null
}

export interface FinancialSummary {
  entradasTotales: number
  costoProductosVendidos: number | null
  gastosTotal: number
  /** Solo categorías con gasto > 0, ordenadas de mayor a menor. */
  porCategoria: CategoryExpenseSummary[]
  pctGastosSobreEntradas: number | null
  utilidadNeta: number
  /** Margen neto (%) sobre entradas. `null` si no hay entradas. */
  margenNeto: number | null
}

function pctOf(part: number, total: number): number | null {
  if (total <= 0) return null
  return Math.round((part / total) * 1000) / 10
}

/**
 * Núcleo del módulo de finanzas: relaciona los gastos del negocio con las
 * entradas totales del período. Función pura — la página solo la alimenta.
 *
 *   Utilidad neta = entradas − costo de productos vendidos − gastos activos
 */
export function buildFinancialSummary(input: FinancialSummaryInput): FinancialSummary {
  const activos = input.gastos.filter((g) => g.status === 'active')
  const gastosTotal = activos.reduce((sum, g) => sum + g.monto, 0)

  const totalsByCategory = new Map<string, number>()
  for (const gasto of activos) {
    totalsByCategory.set(gasto.categoryId, (totalsByCategory.get(gasto.categoryId) ?? 0) + gasto.monto)
  }

  const nombres = new Map(input.categorias.map((c) => [c.id, c.nombre]))
  const porCategoria: CategoryExpenseSummary[] = [...totalsByCategory.entries()]
    .map(([categoryId, total]) => ({
      categoryId,
      nombre: nombres.get(categoryId) ?? 'Sin categoría',
      total,
      pctSobreEntradas: pctOf(total, input.entradasTotales),
    }))
    .sort((a, b) => b.total - a.total)

  const utilidadNeta =
    input.entradasTotales - (input.costoProductosVendidos ?? 0) - gastosTotal

  return {
    entradasTotales: input.entradasTotales,
    costoProductosVendidos: input.costoProductosVendidos,
    gastosTotal,
    porCategoria,
    pctGastosSobreEntradas: pctOf(gastosTotal, input.entradasTotales),
    utilidadNeta,
    margenNeto: pctOf(utilidadNeta, input.entradasTotales),
  }
}
