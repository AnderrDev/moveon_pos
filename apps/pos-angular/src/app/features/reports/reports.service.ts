import { inject, Injectable } from '@angular/core'
import { SalesRepository } from '../sales/sales.repository'
import { CashRegisterRepository } from '../cash-register/cash-register.repository'
import { InventoryRepository } from '../inventory/inventory.repository'
import { ProductsRepository } from '../products/products.repository'
import { TiendaInfoService } from '../../core/tienda/tienda-info.service'
import {
  DEFAULT_TIMEZONE,
  getStoreDayRangeUtc,
} from '@/modules/reports/domain/services/day-range'
import { isLowStock } from '@/modules/inventory/domain/services/low-stock'
import {
  groupSalesByCashier,
  type CashierSalesSummary,
} from '@/modules/reports/domain/services/group-sales-by-cashier'
import type { Sale } from '@/modules/sales/domain/entities/sale.entity'

export interface DailyPaymentBreakdown {
  metodo: string
  count: number
  total: number
}

export interface DailyTopProduct {
  productId: string
  nombre: string
  qty: number
  total: number
}

export interface DailySaleDetail {
  id: string
  saleNumber: string
  createdAt: Date
  status: string
  total: number
  itemCount: number
  payments: { metodo: string; amount: number }[]
}

export interface DailySession {
  id: string
  openedAt: Date
  closedAt: Date | null
  expectedSalesAmount: number
  actualSalesAmount: number | null
  salesDifference: number | null
  expectedCashAmount: number
  actualCashAmount: number | null
  cashDifference: number | null
}

export interface DailyReport {
  date: Date
  totalVentas: number
  countVentas: number
  countAnuladas: number
  subtotalVentas: number
  taxTotal: number
  discountTotal: number
  avgVenta: number
  paymentBreakdown: DailyPaymentBreakdown[]
  topProducts: DailyTopProduct[]
  cashierBreakdown: CashierSalesSummary[]
  salesDetail: DailySaleDetail[]
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
}

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private readonly salesRepo = inject(SalesRepository)
  private readonly cashRepo = inject(CashRegisterRepository)
  private readonly inventoryRepo = inject(InventoryRepository)
  private readonly productsRepo = inject(ProductsRepository)
  private readonly tiendaInfo = inject(TiendaInfoService)

  /**
   * Reporte diario del día calendario `dateIso` (`YYYY-MM-DD`) en la zona
   * horaria de la tienda. El rango UTC `[start, end)` se calcula con la función
   * de dominio `getStoreDayRangeUtc` para que una venta a las 23:30 hora local
   * caiga en el día local correcto y no en el día UTC.
   */
  async getDailyReport(tiendaId: string, dateIso: string): Promise<DailyReport> {
    let timezone = DEFAULT_TIMEZONE
    try {
      timezone = (await this.tiendaInfo.get(tiendaId)).timezone
    } catch {
      timezone = DEFAULT_TIMEZONE
    }

    const { start: dayStart, end: dayEnd } = getStoreDayRangeUtc(dateIso, timezone)

    const [sales, filteredSessions] = await Promise.all([
      this.salesRepo.listByDate(tiendaId, dayStart, dayEnd),
      this.cashRepo.listSessionsByDateRange(tiendaId, dayStart, dayEnd),
    ])

    const completed = sales.filter((s) => s.status === 'completed')
    const voided = sales.filter((s) => s.status === 'voided')

    const totalVentas = completed.reduce((s, v) => s + v.total, 0)
    const subtotalVentas = completed.reduce((s, v) => s + v.subtotal, 0)
    const taxTotal = completed.reduce((s, v) => s + v.taxTotal, 0)
    const discountTotal = completed.reduce((s, v) => s + v.discountTotal, 0)
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

    const prodMap = new Map<string, { nombre: string; qty: number; total: number }>()
    for (const sale of completed) {
      for (const item of sale.items) {
        const cur = prodMap.get(item.productId) ?? {
          nombre: item.productoNombre,
          qty: 0,
          total: 0,
        }
        prodMap.set(item.productId, {
          nombre: cur.nombre,
          qty: cur.qty + item.quantity,
          total: cur.total + item.total,
        })
      }
    }
    const topProducts: DailyTopProduct[] = Array.from(prodMap.entries())
      .map(([productId, v]) => ({ productId, ...v }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5)

    // Desglose por cajero: agrupación en cliente sobre las ventas ya cargadas
    // del día (completadas + anuladas). Cero queries nuevas. La función de
    // dominio suma totales/IVA solo de completadas y cuenta las anuladas aparte.
    const cashierBreakdown = groupSalesByCashier(sales)

    const salesDetail: DailySaleDetail[] = [...sales]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((s: Sale) => ({
        id: s.id,
        saleNumber: s.saleNumber,
        createdAt: s.createdAt,
        status: s.status,
        total: s.total,
        itemCount: s.items.reduce((acc, i) => acc + i.quantity, 0),
        payments: s.payments.map((p) => ({ metodo: p.metodo, amount: p.amount })),
      }))

    return {
      date: dayStart,
      totalVentas,
      countVentas: completed.length,
      countAnuladas: voided.length,
      subtotalVentas,
      taxTotal,
      discountTotal,
      avgVenta,
      paymentBreakdown,
      topProducts,
      cashierBreakdown,
      salesDetail,
      sessions: filteredSessions.map((s) => ({
        id: s.id,
        openedAt: s.openedAt,
        closedAt: s.closedAt,
        expectedSalesAmount: s.expectedSalesAmount ?? 0,
        actualSalesAmount: s.actualSalesAmount,
        salesDifference: s.salesDifference,
        expectedCashAmount: s.expectedCashAmount ?? 0,
        actualCashAmount: s.actualCashAmount,
        cashDifference: s.difference,
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
        }
      })
      .sort((a, b) => {
        if (a.isLow !== b.isLow) return a.isLow ? -1 : 1
        return a.nombre.localeCompare(b.nombre)
      })
  }
}
