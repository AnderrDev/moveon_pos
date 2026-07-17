import type { CashMovement } from '@/modules/cash-register/domain/entities/cash-session.entity'
import type { Sale } from '@/modules/sales/domain/entities/sale.entity'
import { getPaymentMethodLabel } from '@/shared/lib/payment-methods'
import type { ExcelWorkbookDefinition } from '../../shared/services/export/excel-export.service'
import { buildExportFilename } from '../../shared/services/export/export-filename'

const CASH_MOVEMENT_LABELS: Record<string, string> = {
  cash_in: 'Ingreso',
  cash_out: 'Egreso',
  expense: 'Gasto',
  correction: 'Correccion',
}

function saleStatusLabel(status: Sale['status']): string {
  return status === 'voided' ? 'Anulada' : 'Completada'
}

function cashMovementStatusLabel(status: CashMovement['status']): string {
  return status === 'voided' ? 'Anulado' : 'Activo'
}

function cashierLabel(sale: Sale): string {
  return sale.cashierEmail ?? `Usuario ${sale.cashierId.slice(0, 8)}`
}

export function buildTurnSalesWorkbook(
  sales: readonly Sale[],
  cashMovements: readonly CashMovement[]
): ExcelWorkbookDefinition {
  const completed = sales.filter((sale) => sale.status === 'completed')
  const voided = sales.filter((sale) => sale.status === 'voided')
  const completedTotal = completed.reduce((total, sale) => total + sale.total, 0)
  const paymentTotals = new Map<string, { count: number; total: number }>()

  for (const sale of completed) {
    for (const payment of sale.payments) {
      const current = paymentTotals.get(payment.metodo) ?? { count: 0, total: 0 }
      paymentTotals.set(payment.metodo, {
        count: current.count + 1,
        total: current.total + payment.amount,
      })
    }
  }

  return {
    filename: buildExportFilename('ventas-turno'),
    sheets: [
      {
        name: 'Resumen',
        title: 'Resumen del turno',
        subtitle: `${sales.length} ventas registradas`,
        columns: [
          { header: 'Sección', width: 20 },
          { header: 'Indicador', width: 34 },
          { header: 'Cantidad', width: 14, format: 'integer' },
          { header: 'Valor', width: 18, format: 'currency' },
        ],
        rows: [
          ['Ventas', 'Ventas completadas', completed.length, completedTotal],
          ['Ventas', 'Ventas anuladas', voided.length, null],
          [
            'Ventas',
            'Descuentos aplicados',
            null,
            completed.reduce((total, sale) => total + sale.discountTotal, 0),
          ],
          [
            'Descuentos',
            'Por productos',
            null,
            completed.reduce((total, sale) => total + sale.itemDiscountTotal, 0),
          ],
          [
            'Descuentos',
            'Globales',
            null,
            completed.reduce((total, sale) => total + sale.globalDiscountTotal, 0),
          ],
          [
            'Ventas',
            'IVA incluido',
            null,
            completed.reduce((total, sale) => total + sale.taxTotal, 0),
          ],
          ...Array.from(paymentTotals.entries()).map(
            ([method, value]) =>
              ['Métodos de pago', getPaymentMethodLabel(method), value.count, value.total] as const
          ),
        ],
      },
      {
        name: 'Ventas',
        title: 'Ventas del turno',
        subtitle: `${sales.length} ventas`,
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
          { header: 'Motivo descuento', width: 38 },
          { header: 'IVA', width: 16, format: 'currency' },
          { header: 'Total', width: 16, format: 'currency' },
          { header: 'Recibido', width: 16, format: 'currency' },
          { header: 'Cambio', width: 16, format: 'currency' },
          { header: 'Motivo de anulación', width: 40 },
        ],
        rows: sales.map((sale) => [
          sale.createdAt,
          sale.saleNumber,
          saleStatusLabel(sale.status),
          cashierLabel(sale),
          sale.clienteNombre ?? 'Consumidor final',
          sale.items.reduce((total, item) => total + item.quantity, 0),
          sale.subtotal,
          sale.discountTotal,
          sale.itemDiscountTotal,
          sale.globalDiscountTotal,
          sale.discountReason,
          sale.taxTotal,
          sale.total,
          sale.payments.reduce((total, payment) => total + payment.amount, 0),
          sale.change,
          sale.voidedReason,
        ]),
      },
      {
        name: 'Productos',
        title: 'Productos vendidos en el turno',
        subtitle: `${sales.reduce((total, sale) => total + sale.items.length, 0)} líneas de venta`,
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
        rows: sales.flatMap((sale) =>
          sale.items.map((item) => [
            sale.createdAt,
            sale.saleNumber,
            saleStatusLabel(sale.status),
            cashierLabel(sale),
            item.productoNombre,
            item.productoSku,
            item.quantity,
            item.unitPrice,
            item.discountAmount * item.quantity + item.globalDiscountAmount,
            item.discountAmount * item.quantity,
            item.globalDiscountAmount,
            item.taxRate,
            item.taxAmount,
            item.total,
          ])
        ),
      },
      {
        name: 'Pagos',
        title: 'Pagos recibidos en el turno',
        subtitle: `${sales.reduce((total, sale) => total + sale.payments.length, 0)} registros`,
        columns: [
          { header: 'Fecha y hora', width: 22, format: 'datetime' },
          { header: 'Venta', width: 16 },
          { header: 'Estado', width: 14 },
          { header: 'Usuario', width: 30 },
          { header: 'Método', width: 20 },
          { header: 'Monto', width: 18, format: 'currency' },
          { header: 'Referencia', width: 24 },
        ],
        rows: sales.flatMap((sale) =>
          sale.payments.map((payment) => [
            payment.createdAt,
            sale.saleNumber,
            saleStatusLabel(sale.status),
            cashierLabel(sale),
            getPaymentMethodLabel(payment.metodo),
            payment.amount,
            payment.referencia,
          ])
        ),
      },
      {
        name: 'Movimientos de caja',
        title: 'Movimientos de caja del turno',
        subtitle: `${cashMovements.length} movimientos manuales`,
        columns: [
          { header: 'Fecha y hora', width: 22, format: 'datetime' },
          { header: 'Tipo', width: 16 },
          { header: 'Estado', width: 14 },
          { header: 'Motivo', width: 42 },
          { header: 'Monto', width: 18, format: 'currency' },
          { header: 'Motivo de anulación', width: 40 },
        ],
        rows: cashMovements.map((movement) => [
          movement.createdAt,
          CASH_MOVEMENT_LABELS[movement.tipo] ?? movement.tipo,
          cashMovementStatusLabel(movement.status),
          movement.motivo,
          movement.tipo === 'cash_in' ? movement.amount : -movement.amount,
          movement.voidedReason,
        ]),
      },
    ],
  }
}
