import { getPaymentMethodLabel } from '@/shared/lib/payment-methods'
import type { ExcelWorkbookDefinition } from '../../shared/services/export/excel-export.service'
import { buildExportFilename } from '../../shared/services/export/export-filename'
import type { DailyReport, StockReportRow } from './reports.service'

function saleStatusLabel(status: string): string {
  return status === 'voided' ? 'Anulada' : 'Completada'
}

export function buildDailyReportWorkbook(
  report: DailyReport,
  fromIso: string,
  toIso = fromIso,
): ExcelWorkbookDefinition {
  const cashierEmailById = new Map(
    report.salesDetail.map((sale) => [sale.cashierId, sale.cashierEmail] as const)
  )
  const periodLabel = fromIso === toIso ? fromIso : `${fromIso}_${toIso}`
  const periodTitle = fromIso === toIso ? fromIso : `${fromIso} al ${toIso}`

  return {
    filename: `moveonapp-reporte-${periodLabel}.xlsx`,
    sheets: [
      {
        name: 'Resumen',
        title: `Reporte · ${periodTitle}`,
        subtitle: 'Resumen de ventas, pagos y productos',
        columns: [
          { header: 'Sección', width: 20 },
          { header: 'Indicador', width: 34 },
          { header: 'Cantidad', width: 14, format: 'integer' },
          { header: 'Valor', width: 18, format: 'currency' },
        ],
        rows: [
          ['Ventas', 'Ventas completadas', report.countVentas, report.totalVentas],
          ['Ventas', 'Ventas anuladas', report.countAnuladas, null],
          ['Ventas', 'Ticket promedio', null, report.avgVenta],
          ['Ventas', 'Subtotal', null, report.subtotalVentas],
          ['Ventas', 'Descuentos', null, report.discountTotal],
          ['Descuentos', 'Por productos', null, report.itemDiscountTotal],
          ['Descuentos', 'Globales', null, report.globalDiscountTotal],
          ['Descuentos', 'Ventas con descuento', report.discountedSalesCount, null],
          [
            'Descuentos',
            'Porcentaje promedio',
            null,
            `${report.averageDiscountPercentage.toFixed(2)}%`,
          ],
          ['Ventas', 'IVA incluido', null, report.taxTotal],
          ['Ventas', 'Utilidad total (costo actual)', null, report.utilidadTotal],
          ...report.paymentBreakdown.map(
            (payment) =>
              [
                'Métodos de pago',
                getPaymentMethodLabel(payment.metodo),
                payment.count,
                payment.total,
              ] as const
          ),
          ...report.productSales.map(
            (product) =>
              ['Productos vendidos', product.nombre, product.qty, product.total] as const
          ),
        ],
      },
      {
        name: 'Ventas',
        title: `Ventas · ${periodTitle}`,
        subtitle: `${report.salesDetail.length} ventas registradas`,
        columns: [
          { header: 'Fecha y hora', width: 22, format: 'datetime' },
          { header: 'Número', width: 16 },
          { header: 'Estado', width: 14 },
          { header: 'Usuario', width: 30 },
          { header: 'Cliente', width: 28 },
          { header: 'Unidades', width: 12, format: 'integer' },
          { header: 'Subtotal', width: 16, format: 'currency' },
          { header: 'Descuento', width: 16, format: 'currency' },
          { header: 'Desc. productos', width: 18, format: 'currency' },
          { header: 'Desc. global', width: 16, format: 'currency' },
          { header: 'Descuento %', width: 14, format: 'percent' },
          { header: 'Motivo descuento', width: 38 },
          { header: 'IVA', width: 16, format: 'currency' },
          { header: 'Total', width: 16, format: 'currency' },
          { header: 'Cambio', width: 16, format: 'currency' },
          { header: 'Motivo de anulación', width: 38 },
        ],
        rows: report.salesDetail.map((sale) => [
          sale.createdAt,
          sale.saleNumber,
          saleStatusLabel(sale.status),
          sale.cashierEmail ?? `Usuario ${sale.cashierId.slice(0, 8)}`,
          sale.customerName ?? 'Consumidor final',
          sale.itemCount,
          sale.subtotal,
          sale.discountTotal,
          sale.itemDiscountTotal,
          sale.globalDiscountTotal,
          sale.discountPercentage / 100,
          sale.discountReason,
          sale.taxTotal,
          sale.total,
          sale.change,
          sale.voidedReason,
        ]),
      },
      {
        name: 'Productos',
        title: `Productos vendidos · ${periodTitle}`,
        subtitle: `${report.saleItems.length} líneas de venta`,
        columns: [
          { header: 'Fecha y hora', width: 22, format: 'datetime' },
          { header: 'Venta', width: 16 },
          { header: 'Estado', width: 14 },
          { header: 'Usuario', width: 30 },
          { header: 'Producto', width: 38 },
          { header: 'SKU', width: 16 },
          { header: 'Cantidad', width: 12, format: 'integer' },
          { header: 'Precio unitario', width: 18, format: 'currency' },
          { header: 'Descuento', width: 16, format: 'currency' },
          { header: 'Desc. producto', width: 18, format: 'currency' },
          { header: 'Desc. global', width: 16, format: 'currency' },
          { header: 'IVA tasa', width: 12, format: 'percent' },
          { header: 'IVA incluido', width: 16, format: 'currency' },
          { header: 'Total', width: 16, format: 'currency' },
        ],
        rows: report.saleItems.map((item) => [
          item.createdAt,
          item.saleNumber,
          saleStatusLabel(item.status),
          item.cashierEmail ?? 'Sin usuario legible',
          item.productName,
          item.productSku,
          item.quantity,
          item.unitPrice,
          item.discountTotal,
          item.itemDiscountTotal,
          item.globalDiscountTotal,
          item.taxRate,
          item.taxAmount,
          item.total,
        ]),
      },
      {
        name: 'Utilidad',
        title: `Utilidad por producto · ${periodTitle}`,
        subtitle: 'Costo actual del producto, no histórico (ver docs/modules/reports.md)',
        columns: [
          { header: 'Producto', width: 38 },
          { header: 'SKU', width: 16 },
          { header: 'Cantidad', width: 12, format: 'integer' },
          { header: 'Total vendido', width: 18, format: 'currency' },
          { header: 'Costo', width: 18, format: 'currency' },
          { header: 'Utilidad', width: 18, format: 'currency' },
          { header: 'Margen', width: 14, format: 'percent' },
        ],
        rows: report.productSales.map((product) => [
          product.nombre,
          product.sku,
          product.qty,
          product.total,
          product.costoTotal,
          product.utilidad,
          product.margenPct != null ? product.margenPct / 100 : null,
        ]),
      },
      {
        name: 'Descuentos',
        title: `Control de descuentos · ${periodTitle}`,
        subtitle: `${report.discountedSalesCount} ventas completadas con descuento`,
        columns: [
          { header: 'Fecha y hora', width: 22, format: 'datetime' },
          { header: 'Venta', width: 16 },
          { header: 'Usuario', width: 30 },
          { header: 'Cliente', width: 28 },
          { header: 'Subtotal', width: 18, format: 'currency' },
          { header: 'Desc. productos', width: 18, format: 'currency' },
          { header: 'Desc. global', width: 18, format: 'currency' },
          { header: 'Descuento total', width: 18, format: 'currency' },
          { header: 'Porcentaje', width: 14, format: 'percent' },
          { header: 'Motivo', width: 42 },
          { header: 'Aprobación admin', width: 22 },
        ],
        rows: report.salesDetail
          .filter((sale) => sale.status === 'completed' && sale.discountTotal > 0)
          .map((sale) => [
            sale.createdAt,
            sale.saleNumber,
            sale.cashierEmail ?? `Usuario ${sale.cashierId.slice(0, 8)}`,
            sale.customerName ?? 'Consumidor final',
            sale.subtotal,
            sale.itemDiscountTotal,
            sale.globalDiscountTotal,
            sale.discountTotal,
            sale.discountPercentage / 100,
            sale.discountReason ?? 'Histórico sin motivo',
            sale.discountApprovedBy ? 'Sí' : 'No requerida',
          ]),
      },
      {
        name: 'Pagos',
        title: `Pagos recibidos · ${periodTitle}`,
        subtitle: `${report.salePayments.length} registros de pago`,
        columns: [
          { header: 'Fecha y hora', width: 22, format: 'datetime' },
          { header: 'Venta', width: 16 },
          { header: 'Estado', width: 14 },
          { header: 'Usuario', width: 30 },
          { header: 'Método', width: 20 },
          { header: 'Monto', width: 18, format: 'currency' },
          { header: 'Referencia', width: 24 },
        ],
        rows: report.salePayments.map((payment) => [
          payment.createdAt,
          payment.saleNumber,
          saleStatusLabel(payment.status),
          payment.cashierEmail ?? 'Sin usuario legible',
          getPaymentMethodLabel(payment.method),
          payment.amount,
          payment.reference,
        ]),
      },
      {
        name: 'Cajeros',
        title: `Ventas por cajero · ${periodTitle}`,
        subtitle: `${report.cashierBreakdown.length} usuarios`,
        columns: [
          { header: 'Usuario', width: 32 },
          { header: 'Completadas', width: 14, format: 'integer' },
          { header: 'Anuladas', width: 14, format: 'integer' },
          { header: 'Total vendido', width: 18, format: 'currency' },
          { header: 'IVA incluido', width: 18, format: 'currency' },
        ],
        rows: report.cashierBreakdown.map((cashier) => [
          cashierEmailById.get(cashier.cashierId) ?? `Usuario ${cashier.cashierId.slice(0, 8)}`,
          cashier.countCompleted,
          cashier.countVoided,
          cashier.totalVentas,
          cashier.taxTotal,
        ]),
      },
      {
        name: 'Caja',
        title: `Sesiones de caja · ${periodTitle}`,
        subtitle: `${report.sessions.length} sesiones`,
        columns: [
          { header: 'Apertura', width: 22, format: 'datetime' },
          { header: 'Cierre', width: 22, format: 'datetime' },
          { header: 'Ventas esperadas', width: 20, format: 'currency' },
          { header: 'Ventas confirmadas', width: 20, format: 'currency' },
          { header: 'Diferencia ventas', width: 18, format: 'currency' },
          { header: 'Caja esperada', width: 18, format: 'currency' },
          { header: 'Caja contada', width: 18, format: 'currency' },
          { header: 'Diferencia caja', width: 18, format: 'currency' },
        ],
        rows: report.sessions.map((session) => [
          session.openedAt,
          session.closedAt,
          session.expectedSalesAmount,
          session.actualSalesAmount,
          session.salesDifference,
          session.expectedCashAmount,
          session.actualCashAmount,
          session.cashDifference,
        ]),
      },
      {
        name: 'IVA',
        title: `Desglose IVA · ${periodTitle}`,
        subtitle: 'Base gravable e IVA generado por tasa (ventas completadas)',
        columns: [
          { header: 'Tasa IVA', width: 14, format: 'percent' },
          { header: 'Base gravable', width: 20, format: 'currency' },
          { header: 'IVA generado', width: 20, format: 'currency' },
          { header: 'Total (base + IVA)', width: 22, format: 'currency' },
        ],
        rows: report.taxBreakdown.map((row) => [
          row.taxRate / 100,
          row.baseAmount,
          row.taxAmount,
          row.baseAmount + row.taxAmount,
        ]),
      },
    ],
  }
}

export function buildStockReportWorkbook(rows: readonly StockReportRow[]): ExcelWorkbookDefinition {
  return {
    filename: buildExportFilename('reporte-stock'),
    sheets: [
      {
        name: 'Stock',
        title: 'Reporte de stock actual',
        subtitle: `${rows.length} productos activos`,
        columns: [
          { header: 'Producto', width: 36 },
          { header: 'SKU', width: 16 },
          { header: 'Punto de venta', width: 18, format: 'integer' },
          { header: 'Bodega', width: 14, format: 'integer' },
          { header: 'Stock total', width: 15, format: 'integer' },
          { header: 'Stock mínimo', width: 16, format: 'integer' },
          { header: 'Estado', width: 16 },
        ],
        rows: rows.map((row) => [
          row.nombre,
          row.sku,
          row.puntoVentaStock,
          row.bodegaStock,
          row.totalStock,
          row.minimumStock,
          row.isOut ? 'Agotado' : row.isLow ? 'Stock bajo' : 'Disponible',
        ]),
      },
    ],
  }
}
