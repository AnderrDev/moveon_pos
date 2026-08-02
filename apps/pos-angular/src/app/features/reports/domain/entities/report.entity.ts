import type { CashierSalesSummary } from '@angular-app/features/reports/domain/services/group-sales-by-cashier'
import type { DailySalesSummary, HourlySalesSummary } from '@angular-app/features/reports/domain/services/sales-trend'
import type { Sale } from '@angular-app/features/sales/domain/entities/sale.entity'

/**
 * Read-models del reporte de ventas/contabilidad. TS puro (ADR 0015 §6.1) —
 * extraído de `presentation/services/reports.service.ts` para que el
 * contrato de dominio (`ReportRepository`) y la implementación Supabase
 * (`data/repositories/reports.repository.ts`) compartan la misma forma sin
 * que `domain/` importe de `data/` ni `presentation/`.
 */
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
