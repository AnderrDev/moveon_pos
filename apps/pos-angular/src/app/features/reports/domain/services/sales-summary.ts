/**
 * Servicio de dominio puro (TS, sin Angular/Supabase).
 *
 * Agregados de ventas de un período: totales, descuentos, desglose por método
 * de pago, por producto (con utilidad sobre el costo congelado en la venta,
 * ADR 0019), por cajero, por hora y por día locales. Extraído de
 * `ReportsRepository.getDailyReport` para que la RPC `owner_sales_summary`
 * (app iOS del dueño, ADR 0021 §4) tenga contra qué probar su paridad.
 */
import type { Sale } from '@angular-app/features/sales/domain/entities/sale.entity'
import type { DailyPaymentBreakdown, DailyProductSale } from '@angular-app/features/reports/domain/entities/report.entity'
import { groupSalesByCashier, type CashierSalesSummary } from '@angular-app/features/reports/domain/services/group-sales-by-cashier'
import {
  groupSalesByLocalDay,
  groupSalesByLocalHour,
  type DailySalesSummary,
  type HourlySalesSummary,
} from '@angular-app/features/reports/domain/services/sales-trend'
import { groupSalesByProduct } from '@angular-app/features/reports/domain/services/top-products'

export interface SalesSummary {
  totalVentas: number
  countVentas: number
  countAnuladas: number
  subtotalVentas: number
  taxTotal: number
  discountTotal: number
  itemDiscountTotal: number
  globalDiscountTotal: number
  discountedSalesCount: number
  averageDiscountPercentage: number
  avgVenta: number
  paymentBreakdown: DailyPaymentBreakdown[]
  productSales: DailyProductSale[]
  /** Suma de `utilidad` solo de productos con costo conocido (no asume 0 para costo null). */
  utilidadTotal: number
  cashierBreakdown: CashierSalesSummary[]
  hourlySales: HourlySalesSummary[]
  dailySales: DailySalesSummary[]
}

export function buildSalesSummary(sales: Sale[], timezone: string): SalesSummary {
  const completed = sales.filter((s) => s.status === 'completed')
  const voided = sales.filter((s) => s.status === 'voided')

  const totalVentas = completed.reduce((s, v) => s + v.total, 0)
  const discountedSales = completed.filter((sale) => sale.discountTotal > 0)
  const averageDiscountPercentage =
    discountedSales.length > 0
      ? (discountedSales.reduce(
          (sum, sale) => sum + (sale.subtotal > 0 ? sale.discountTotal / sale.subtotal : 0),
          0
        ) /
          discountedSales.length) *
        100
      : 0

  const { productSales, utilidadTotal } = summarizeProducts(completed)

  return {
    totalVentas,
    countVentas: completed.length,
    countAnuladas: voided.length,
    subtotalVentas: completed.reduce((s, v) => s + v.subtotal, 0),
    taxTotal: completed.reduce((s, v) => s + v.taxTotal, 0),
    discountTotal: completed.reduce((s, v) => s + v.discountTotal, 0),
    itemDiscountTotal: completed.reduce((s, v) => s + v.itemDiscountTotal, 0),
    globalDiscountTotal: completed.reduce((s, v) => s + v.globalDiscountTotal, 0),
    discountedSalesCount: discountedSales.length,
    averageDiscountPercentage,
    avgVenta: completed.length > 0 ? Math.round(totalVentas / completed.length) : 0,
    paymentBreakdown: summarizePayments(completed),
    productSales,
    utilidadTotal,
    // Desglose por cajero: completadas + anuladas.
    cashierBreakdown: groupSalesByCashier(sales),
    // Tendencia (PLAN-38): por hora y por día locales.
    hourlySales: groupSalesByLocalHour(sales, timezone),
    dailySales: groupSalesByLocalDay(sales, timezone),
  }
}

function summarizePayments(completed: Sale[]): DailyPaymentBreakdown[] {
  const payMap = new Map<string, { count: number; total: number }>()
  for (const sale of completed) {
    for (const p of sale.payments) {
      const cur = payMap.get(p.metodo) ?? { count: 0, total: 0 }
      payMap.set(p.metodo, { count: cur.count + 1, total: cur.total + p.amount })
    }
  }
  return Array.from(payMap.entries())
    .map(([metodo, v]) => ({ metodo, ...v }))
    .sort((a, b) => b.total - a.total)
}

/**
 * Costo congelado en la venta (ADR 0019): si a alguna línea le falta el costo,
 * el producto queda en `null` y se excluye de `utilidadTotal` — nunca se asume
 * costo 0.
 */
function summarizeProducts(completed: Sale[]): { productSales: DailyProductSale[]; utilidadTotal: number } {
  let utilidadTotal = 0
  const productSales: DailyProductSale[] = groupSalesByProduct(completed).map((v) => {
    const costoTotal = v.costoTotal
    // Costo unitario promedio ponderado: el costo pudo cambiar entre ventas
    // del período, así que ya no hay un único costo por producto.
    const costoUnitario = costoTotal != null && v.qty > 0 ? Math.round(costoTotal / v.qty) : null
    const utilidad = costoTotal != null ? v.total - costoTotal : null
    const margenPct = utilidad != null && v.total > 0 ? (utilidad / v.total) * 100 : null
    if (utilidad != null) utilidadTotal += utilidad
    return { ...v, costoUnitario, costoTotal, utilidad, margenPct }
  })
  return { productSales, utilidadTotal }
}
