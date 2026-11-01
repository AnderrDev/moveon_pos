import type { PurchasePlan } from '@angular-app/features/inventory/domain/services/purchase-suggestions'
import type { ExcelWorkbookDefinition } from '@angular-app/shared/services/export/excel-export.service'
import { buildExportFilename } from '@angular-app/shared/services/export/export-filename'

const STATUS_LABELS = {
  full: 'Comprar',
  partial: 'Parcial (presupuesto)',
  over_budget: 'Fuera del presupuesto',
  no_cost: 'Sin costo registrado',
} as const

/** Lista de compras sugerida, ordenada por proveedor para armar los pedidos. */
export function buildPurchaseListWorkbook(plan: PurchasePlan, coverDays: number): ExcelWorkbookDefinition {
  const lines = [...plan.lines].sort(
    (a, b) => (a.proveedorNombre ?? '~').localeCompare(b.proveedorNombre ?? '~', 'es') || a.nombre.localeCompare(b.nombre, 'es'),
  )
  return {
    filename: buildExportFilename('lista-de-compras'),
    sheets: [
      {
        name: 'Lista de compras',
        title: 'Lista de compras sugerida',
        subtitle: `Cobertura ${coverDays} días · Presupuesto ${plan.budget ?? 'sin tope'} · Total ${plan.total}`,
        columns: [
          { header: 'Proveedor', width: 24 },
          { header: 'Producto', width: 36 },
          { header: 'Stock actual', width: 14, format: 'integer' },
          { header: 'Venta diaria estimada', width: 20 },
          { header: 'Días que alcanza', width: 16 },
          { header: 'Necesario', width: 12, format: 'integer' },
          { header: 'Comprar', width: 12, format: 'integer' },
          { header: 'Costo unitario', width: 16, format: 'currency' },
          { header: 'Subtotal', width: 16, format: 'currency' },
          { header: 'Estado', width: 22 },
        ],
        rows: lines.map((l) => [
          l.proveedorNombre ?? 'Sin proveedor',
          l.nombre,
          l.stockActual,
          l.consumoDiario,
          l.diasQueAlcanza,
          l.necesario,
          l.sugerido,
          l.costoUnitario,
          l.subtotal,
          STATUS_LABELS[l.status],
        ]),
      },
    ],
  }
}
