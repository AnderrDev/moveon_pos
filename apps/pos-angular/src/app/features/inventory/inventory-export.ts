import type { InventoryMovement } from '@/modules/inventory/domain/entities/inventory.entity'
import type { ExcelWorkbookDefinition } from '../../shared/export/excel-export.service'
import { buildExportFilename } from '../../shared/export/export-filename'

export interface InventoryExportRow {
  nombre: string
  sku: string | null
  puntoVentaStock: number
  bodegaStock: number
  totalStock: number
  minimumStock: number
  isLow: boolean
}

const MOVEMENT_LABELS: Record<string, string> = {
  entry: 'Entrada',
  sale_exit: 'Venta',
  adjustment: 'Ajuste',
  void_return: 'Anulación',
  transfer_out: 'Traslado de salida',
  transfer_in: 'Traslado de entrada',
}

const LOCATION_LABELS: Record<string, string> = {
  punto_venta: 'Punto de venta',
  bodega: 'Bodega',
}

export function buildInventoryWorkbook(
  rows: readonly InventoryExportRow[],
  query: string
): ExcelWorkbookDefinition {
  const normalizedQuery = query.trim()
  return {
    filename: buildExportFilename('inventario'),
    sheets: [
      {
        name: 'Inventario',
        title: 'Inventario actual',
        subtitle: normalizedQuery
          ? `${rows.length} productos · Filtro: ${normalizedQuery}`
          : `${rows.length} productos`,
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
          row.isLow ? 'Stock bajo' : 'Disponible',
        ]),
      },
    ],
  }
}

export function buildKardexWorkbook(
  productName: string,
  movements: readonly InventoryMovement[]
): ExcelWorkbookDefinition {
  return {
    filename: buildExportFilename(`kardex-${productName}`),
    sheets: [
      {
        name: 'Kardex',
        title: `Kardex · ${productName}`,
        subtitle: `${movements.length} movimientos`,
        columns: [
          { header: 'Fecha y hora', width: 22, format: 'datetime' },
          { header: 'Movimiento', width: 22 },
          { header: 'Ubicación', width: 18 },
          { header: 'Cantidad', width: 14, format: 'integer' },
          { header: 'Costo unitario', width: 18, format: 'currency' },
          { header: 'Motivo', width: 42 },
          { header: 'Referencia', width: 20 },
        ],
        rows: movements.map((movement) => [
          movement.createdAt,
          MOVEMENT_LABELS[movement.tipo] ?? movement.tipo,
          LOCATION_LABELS[movement.ubicacion] ?? movement.ubicacion,
          movement.cantidad,
          movement.costoUnitario,
          movement.motivo,
          movement.referenciaTipo,
        ]),
      },
    ],
  }
}
