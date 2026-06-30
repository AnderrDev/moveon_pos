import { inject, Injectable } from '@angular/core'
import { SalesRepository } from '../sales/sales.repository'
import { CashRegisterRepository } from '../cash-register/cash-register.repository'
import { InventoryRepository } from '../inventory/inventory.repository'
import { ProductsRepository } from '../products/products.repository'
import { TiendaInfoService } from '../../core/tienda/tienda-info.service'
import { DEFAULT_TIMEZONE, getStoreRangeUtc } from '@/modules/reports/domain/services/day-range'
import { isLowStock, isOutOfStock } from '@/modules/inventory/domain/services/low-stock'
import {
  groupSalesByCashier,
  type CashierSalesSummary,
} from '@/modules/reports/domain/services/group-sales-by-cashier'
import {
  groupSalesByLocalDay,
  groupSalesByLocalHour,
  type DailySalesSummary,
  type HourlySalesSummary,
} from '@/modules/reports/domain/services/sales-trend'
import { groupSalesByProduct } from '@/modules/reports/domain/services/top-products'
import type { Sale } from '@/modules/sales/domain/entities/sale.entity'

export interface DailyPaymentBreakdown {
  metodo: string
  count: number
  total: number
}

export interface DailyProductSale {
  productId: string
  nombre: string
  sku: string | null
  /** Cantidad de ventas DISTINTAS en las que aparece el producto (PLAN-39). */
  numVentas: number
  qty: number
  total: number
  /** Precio promedio simple de `unitPrice` entre líneas (PLAN-39, no ponderado por cantidad). */
  avgPrice: number
  /** `null` cuando el producto no tiene costo capturado — se excluye de utilidadTotal. */
  costoUnitario: number | null
  costoTotal: number | null
  utilidad: number | null
  margenPct: number | null
}

export interface DailySaleDetail {
  id: string
  saleNumber: string
  createdAt: Date
  status: string
  total: number
  itemCount: number
  cashierId: string
  cashierEmail: string | null
  customerName: string | null
  subtotal: number
  discountTotal: number
  itemDiscountTotal: number
  globalDiscountTotal: number
  discountPercentage: number
  discountReason: string | null
  discountApprovedBy: string | null
  taxTotal: number
  change: number
  voidedReason: string | null
  payments: { metodo: string; amount: number }[]
}

export interface DailySaleItemDetail {
  saleNumber: string
  createdAt: Date
  status: string
  cashierEmail: string | null
  productName: string
  productSku: string | null
  quantity: number
  unitPrice: number
  discountTotal: number
  itemDiscountTotal: number
  globalDiscountTotal: number
  taxRate: number
  taxAmount: number
  total: number
}

export interface DailySalePaymentDetail {
  saleNumber: string
  createdAt: Date
  status: string
  cashierEmail: string | null
  method: string
  amount: number
  reference: string | null
}

export interface DailySession {
  id: string
  openedBy: string
  openedAt: Date
  closedAt: Date | null
  expectedSalesAmount: number
  actualSalesAmount: number | null
  salesDifference: number | null
  expectedCashAmount: number
  actualCashAmount: number | null
  cashDifference: number | null
  notasCierre: string | null
}

export interface TaxBreakdownRow {
  taxRate: number
  baseAmount: number
  taxAmount: number
}

export interface DailyReport {
  /** Primer día del período (UTC inicio del día local). */
  date: Date
  /** Último día del período (UTC inicio del día local). Igual a `date` cuando es un solo día. */
  dateTo: Date
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
  taxBreakdown: TaxBreakdownRow[]
  productSales: DailyProductSale[]
  /** Suma de `utilidad` solo de productos con costo conocido (no asume 0 para costo null). */
  utilidadTotal: number
  cashierBreakdown: CashierSalesSummary[]
  hourlySales: HourlySalesSummary[]
  dailySales: DailySalesSummary[]
  sales: Sale[]
  salesDetail: DailySaleDetail[]
  saleItems: DailySaleItemDetail[]
  salePayments: DailySalePaymentDetail[]
  sessions: DailySession[]
}

export interface StockReportRow {
  productId: string
  nombre: string
  sku: string | null
  puntoVentaStock: number
  bodegaStock: number
  totalStock: number
  minimumStock: number
  isLow: boolean
  isOut: boolean
}

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private readonly salesRepo = inject(SalesRepository)
  private readonly cashRepo = inject(CashRegisterRepository)
  private readonly inventoryRepo = inject(InventoryRepository)
  private readonly productsRepo = inject(ProductsRepository)
  private readonly tiendaInfo = inject(TiendaInfoService)

  /**
   * Reporte del período `[fromIso, toIso]` (ambos días inclusivos) en la zona
   * horaria de la tienda. El rango UTC lo calcula `getStoreRangeUtc`.
   * Si `toIso` se omite, se asume el mismo día que `fromIso` (compatibilidad).
   */
  async getDailyReport(tiendaId: string, fromIso: string, toIso = fromIso): Promise<DailyReport> {
    let timezone = DEFAULT_TIMEZONE
    try {
      timezone = (await this.tiendaInfo.get(tiendaId)).timezone
    } catch {
      timezone = DEFAULT_TIMEZONE
    }

    const { start: dayStart, end: dayEnd } = getStoreRangeUtc(fromIso, toIso, timezone)

    const [sales, filteredSessions, products] = await Promise.all([
      this.salesRepo.listByDate(tiendaId, dayStart, dayEnd),
      this.cashRepo.listSessionsByDateRange(tiendaId, dayStart, dayEnd),
      this.productsRepo.listProducts({ tiendaId, soloActivos: false }),
    ])

    const completed = sales.filter((s) => s.status === 'completed')
    const voided = sales.filter((s) => s.status === 'voided')

    const totalVentas = completed.reduce((s, v) => s + v.total, 0)
    const subtotalVentas = completed.reduce((s, v) => s + v.subtotal, 0)
    const taxTotal = completed.reduce((s, v) => s + v.taxTotal, 0)
    const discountTotal = completed.reduce((s, v) => s + v.discountTotal, 0)
    const itemDiscountTotal = completed.reduce((s, v) => s + v.itemDiscountTotal, 0)
    const globalDiscountTotal = completed.reduce((s, v) => s + v.globalDiscountTotal, 0)
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
    const avgVenta = completed.length > 0 ? Math.round(totalVentas / completed.length) : 0

    const payMap = new Map<string, { count: number; total: number }>()
    for (const sale of completed) {
      for (const p of sale.payments) {
        const cur = payMap.get(p.metodo) ?? { count: 0, total: 0 }
        payMap.set(p.metodo, { count: cur.count + 1, total: cur.total + p.amount })
      }
    }
    const paymentBreakdown: DailyPaymentBreakdown[] = Array.from(payMap.entries())
      .map(([metodo, v]) => ({ metodo, ...v }))
      .sort((a, b) => b.total - a.total)

    // Top productos (PLAN-39): agregación en cliente sobre las ventas ya
    // cargadas del período (solo completadas, semántica de la sección 4 de
    // scripts/reports/business-status-report.sql). Cero queries nuevas.
    const productGroups = groupSalesByProduct(completed)

    // Costo actual del producto (no histórico, ver docs/modules/reports.md):
    // suficiente para "cuánto se está ganando ahora", no exacto si el costo
    // cambió desde que se vendió. Productos sin costo capturado quedan en
    // `null` y se excluyen de utilidadTotal (no se asume costo 0).
    const costMap = new Map(products.map((p) => [p.id, p.costo]))

    let utilidadTotal = 0
    const productSales: DailyProductSale[] = productGroups.map((v) => {
      const costoUnitario = costMap.get(v.productId) ?? null
      const costoTotal = costoUnitario != null ? Math.round(costoUnitario * v.qty) : null
      const utilidad = costoTotal != null ? v.total - costoTotal : null
      const margenPct = utilidad != null && v.total > 0 ? (utilidad / v.total) * 100 : null
      if (utilidad != null) utilidadTotal += utilidad
      return { ...v, costoUnitario, costoTotal, utilidad, margenPct }
    })

    // Desglose por cajero: agrupación en cliente sobre las ventas ya cargadas
    // del período (completadas + anuladas). Cero queries nuevas.
    const cashierBreakdown = groupSalesByCashier(sales)

    // Tendencia (PLAN-38): ventas por hora local y por día local, agrupación
    // en cliente sobre las mismas ventas ya cargadas. Cero queries nuevas.
    const hourlySales = groupSalesByLocalHour(sales, timezone)
    const dailySales = groupSalesByLocalDay(sales, timezone)

    // Desglose de IVA por tasa: solo ventas completadas, agrupadas por taxRate.
    const taxMap = new Map<number, { baseAmount: number; taxAmount: number }>()
    for (const sale of completed) {
      for (const item of sale.items) {
        const cur = taxMap.get(item.taxRate) ?? { baseAmount: 0, taxAmount: 0 }
        // La base gravable por ítem es (total del ítem − IVA del ítem).
        taxMap.set(item.taxRate, {
          baseAmount: cur.baseAmount + (item.total - item.taxAmount),
          taxAmount: cur.taxAmount + item.taxAmount,
        })
      }
    }
    const taxBreakdown: TaxBreakdownRow[] = Array.from(taxMap.entries())
      .map(([taxRate, v]) => ({ taxRate, ...v }))
      .sort((a, b) => b.taxRate - a.taxRate)

    const salesDetail: DailySaleDetail[] = [...sales]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((s: Sale) => ({
        id: s.id,
        saleNumber: s.saleNumber,
        createdAt: s.createdAt,
        status: s.status,
        total: s.total,
        itemCount: s.items.reduce((acc, i) => acc + i.quantity, 0),
        cashierId: s.cashierId,
        cashierEmail: s.cashierEmail,
        customerName: s.clienteNombre,
        subtotal: s.subtotal,
        discountTotal: s.discountTotal,
        itemDiscountTotal: s.itemDiscountTotal,
        globalDiscountTotal: s.globalDiscountTotal,
        discountPercentage: s.subtotal > 0 ? (s.discountTotal / s.subtotal) * 100 : 0,
        discountReason: s.discountReason,
        discountApprovedBy: s.discountApprovedBy,
        taxTotal: s.taxTotal,
        change: s.change,
        voidedReason: s.voidedReason,
        payments: s.payments.map((p) => ({ metodo: p.metodo, amount: p.amount })),
      }))

    const saleItems: DailySaleItemDetail[] = sales.flatMap((sale) =>
      sale.items.map((item) => ({
        saleNumber: sale.saleNumber,
        createdAt: sale.createdAt,
        status: sale.status,
        cashierEmail: sale.cashierEmail,
        productName: item.productoNombre,
        productSku: item.productoSku,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountTotal: item.discountAmount * item.quantity + item.globalDiscountAmount,
        itemDiscountTotal: item.discountAmount * item.quantity,
        globalDiscountTotal: item.globalDiscountAmount,
        taxRate: item.taxRate,
        taxAmount: item.taxAmount,
        total: item.total,
      }))
    )

    const salePayments: DailySalePaymentDetail[] = sales.flatMap((sale) =>
      sale.payments.map((payment) => ({
        saleNumber: sale.saleNumber,
        createdAt: sale.createdAt,
        status: sale.status,
        cashierEmail: sale.cashierEmail,
        method: payment.metodo,
        amount: payment.amount,
        reference: payment.referencia,
      }))
    )

    return {
      date: dayStart,
      dateTo: dayEnd,
      totalVentas,
      countVentas: completed.length,
      countAnuladas: voided.length,
      subtotalVentas,
      taxTotal,
      discountTotal,
      itemDiscountTotal,
      globalDiscountTotal,
      discountedSalesCount: discountedSales.length,
      averageDiscountPercentage,
      avgVenta,
      paymentBreakdown,
      taxBreakdown,
      productSales,
      utilidadTotal,
      cashierBreakdown,
      hourlySales,
      dailySales,
      sales,
      salesDetail,
      saleItems,
      salePayments,
      sessions: filteredSessions.map((s) => ({
        id: s.id,
        openedBy: s.openedBy,
        openedAt: s.openedAt,
        closedAt: s.closedAt,
        expectedSalesAmount: s.expectedSalesAmount ?? 0,
        actualSalesAmount: s.actualSalesAmount,
        salesDifference: s.salesDifference,
        expectedCashAmount: s.expectedCashAmount ?? 0,
        actualCashAmount: s.actualCashAmount,
        cashDifference: s.difference,
        notasCierre: s.notasCierre,
      })),
    }
  }

  async getStockReport(tiendaId: string): Promise<StockReportRow[]> {
    const [stockLevels, products] = await Promise.all([
      this.inventoryRepo.getStockLevels(tiendaId),
      this.productsRepo.listProducts({ tiendaId, soloActivos: true }),
    ])

    const productMap = Object.fromEntries(products.map((p) => [p.id, p]))

    return stockLevels
      .filter((sl) => productMap[sl.productId])
      .map((sl) => {
        const p = productMap[sl.productId]
        return {
          productId: sl.productId,
          nombre: p.nombre,
          sku: p.sku,
          puntoVentaStock: sl.puntoVentaStock,
          bodegaStock: sl.bodegaStock,
          totalStock: sl.totalStock,
          minimumStock: sl.minimumStock,
          isLow: isLowStock({
            tipo: p.tipo,
            currentStock: sl.puntoVentaStock,
            minimumStock: sl.minimumStock,
          }),
          isOut: isOutOfStock({ tipo: p.tipo, currentStock: sl.puntoVentaStock }),
        }
      })
      .sort((a, b) => {
        if (a.isOut !== b.isOut) return a.isOut ? -1 : 1
        if (a.isLow !== b.isLow) return a.isLow ? -1 : 1
        return a.nombre.localeCompare(b.nombre)
      })
  }
}
