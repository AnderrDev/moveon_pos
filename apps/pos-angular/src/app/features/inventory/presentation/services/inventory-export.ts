import type { InventoryMovement } from '@angular-app/features/inventory/domain/entities/inventory.entity'
import type { ExcelWorkbookDefinition } from '@angular-app/shared/services/export/excel-export.service'
import { buildExportFilename } from '@angular-app/shared/services/export/export-filename'

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
