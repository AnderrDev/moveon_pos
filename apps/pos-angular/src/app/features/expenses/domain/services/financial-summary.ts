import type { Expense, ExpenseCategory } from '@angular-app/features/expenses/domain/entities/expense.entity'

export interface FinancialSummaryInput {
  /** Total de ventas completadas del período (entradas totales). */
  entradasTotales: number
  /** Desglose de entradas por método de pago de ventas completadas. */
  paymentBreakdown?: readonly PaymentBreakdownInput[]
  /**
   * Costo de los productos vendidos en el período (utilidad bruta de reportes).
   * `null` cuando ningún producto tiene costo capturado — se muestra "—" y
   * la utilidad neta se calcula sin este componente.
   */
  costoProductosVendidos: number | null
  /** Líneas/unidades vendidas con producto sin costo capturado. No entran en COGS. */
  ventasSinCosto?: number
  unidadesSinCosto?: number
  /** Gastos del período; los anulados se ignoran. */
  gastos: readonly Expense[]
  categorias: readonly ExpenseCategory[]
}

export interface PaymentBreakdownInput {
  metodo: string
  total: number
}

export interface PaymentMethodSummary {
  metodo: string
  total: number
  /** % del método sobre las entradas. `null` si no hay entradas. */
  pctSobreEntradas: number | null
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
  entradasPorMetodo: PaymentMethodSummary[]
  costoProductosVendidos: number | null
  ventasSinCosto: number
  unidadesSinCosto: number
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

  const entradasPorMetodo = (input.paymentBreakdown ?? [])
    .map((p) => ({
      metodo: p.metodo,
      total: p.total,
      pctSobreEntradas: pctOf(p.total, input.entradasTotales),
    }))
    .filter((p) => p.total > 0)
    .sort((a, b) => {
      const order = ['cash', 'transfer', 'card', 'other']
      const ai = order.indexOf(a.metodo)
      const bi = order.indexOf(b.metodo)
      if (ai !== -1 || bi !== -1) return (ai === -1 ? order.length : ai) - (bi === -1 ? order.length : bi)
      return b.total - a.total
    })

  return {
    entradasTotales: input.entradasTotales,
    entradasPorMetodo,
    costoProductosVendidos: input.costoProductosVendidos,
    ventasSinCosto: input.ventasSinCosto ?? 0,
    unidadesSinCosto: input.unidadesSinCosto ?? 0,
    gastosTotal,
    porCategoria,
    pctGastosSobreEntradas: pctOf(gastosTotal, input.entradasTotales),
    utilidadNeta,
    margenNeto: pctOf(utilidadNeta, input.entradasTotales),
  }
}
