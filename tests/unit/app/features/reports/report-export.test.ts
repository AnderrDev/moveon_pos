import { describe, expect, it } from 'vitest'
import { buildDailyReportWorkbook } from '../../../../../apps/pos-angular/src/app/features/reports/report-export'
import type { DailyReport } from '../../../../../apps/pos-angular/src/app/features/reports/reports.service'

function makeReport(): DailyReport {
  return {
    date: new Date('2026-06-15T05:00:00Z'),
    dateTo: new Date('2026-06-15T05:00:00Z'),
    totalVentas: 90_000,
    countVentas: 1,
    countAnuladas: 0,
    subtotalVentas: 100_000,
    taxTotal: 14_370,
    discountTotal: 10_000,
    itemDiscountTotal: 6_000,
    globalDiscountTotal: 4_000,
    discountedSalesCount: 1,
    averageDiscountPercentage: 10,
    avgVenta: 90_000,
    paymentBreakdown: [],
    taxBreakdown: [],
    productSales: [],
    utilidadTotal: 0,
    cashierBreakdown: [],
    sales: [],
    salesDetail: [
      {
        id: 'sale-1',
        saleNumber: 'V-000001',
        createdAt: new Date('2026-06-15T15:00:00Z'),
        status: 'completed',
        total: 90_000,
        itemCount: 1,
        cashierId: 'cashier-1',
        cashierEmail: 'admin@moveonapp.co',
        customerName: null,
        subtotal: 100_000,
        discountTotal: 10_000,
        itemDiscountTotal: 6_000,
        globalDiscountTotal: 4_000,
        discountPercentage: 10,
        discountReason: 'Promoción del día',
        discountApprovedBy: null,
        taxTotal: 14_370,
        change: 0,
        voidedReason: null,
        payments: [{ metodo: 'cash', amount: 90_000 }],
      },
    ],
    saleItems: [],
    salePayments: [],
    sessions: [],
  }
}

describe('buildDailyReportWorkbook descuentos', () => {
  it('crea una hoja dedicada con desglose, porcentaje y motivo', () => {
    const workbook = buildDailyReportWorkbook(makeReport(), '2026-06-15', '2026-06-15')
    const sheet = workbook.sheets.find((candidate) => candidate.name === 'Descuentos')

    expect(sheet).toBeDefined()
    expect(sheet?.rows).toHaveLength(1)
    expect(sheet?.rows[0]).toContain('Promoción del día')
    expect(sheet?.rows[0]).toContain(6_000)
    expect(sheet?.rows[0]).toContain(4_000)
  })
})

describe('buildDailyReportWorkbook utilidad', () => {
  it('crea la hoja Utilidad con costo/utilidad/margen, mostrando null para productos sin costo', () => {
    const report = makeReport()
    report.productSales = [
      {
        productId: 'p1',
        nombre: 'Proteina',
        sku: 'PRO-1',
        qty: 2,
        total: 200_000,
        costoUnitario: 50_000,
        costoTotal: 100_000,
        utilidad: 100_000,
        margenPct: 50,
      },
      {
        productId: 'p2',
        nombre: 'Sin costo',
        sku: null,
        qty: 1,
        total: 10_000,
        costoUnitario: null,
        costoTotal: null,
        utilidad: null,
        margenPct: null,
      },
    ]
    report.utilidadTotal = 100_000

    const workbook = buildDailyReportWorkbook(report, '2026-06-15', '2026-06-15')
    const sheet = workbook.sheets.find((candidate) => candidate.name === 'Utilidad')

    expect(sheet).toBeDefined()
    expect(sheet?.rows).toEqual([
      ['Proteina', 'PRO-1', 2, 200_000, 100_000, 100_000, 0.5],
      ['Sin costo', null, 1, 10_000, null, null, null],
    ])
  })
})
