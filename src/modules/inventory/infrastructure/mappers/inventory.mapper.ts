import type { InventoryMovement } from '../../domain/entities/inventory.entity'
import type { InventoryMovementType } from '@/shared/types'

export interface InventoryMovementRow {
  id: string
  tienda_id: string
  producto_id: string
  tipo: string
  cantidad: number
  costo_unitario: number | null
  motivo: string | null
  referencia_tipo: string | null
  referencia_id: string | null
  created_by: string
  created_at: string
}

export function rowToInventoryMovement(row: InventoryMovementRow): InventoryMovement {
  return {
    id: row.id,
    tiendaId: row.tienda_id,
    productId: row.producto_id,
    tipo: row.tipo as InventoryMovementType,
    cantidad: Number(row.cantidad),
    costoUnitario: row.costo_unitario !== null ? Number(row.costo_unitario) : null,
    motivo: row.motivo,
    referenciaTipo: row.referencia_tipo,
    referenciaId: row.referencia_id,
    createdBy: row.created_by,
    createdAt: new Date(row.created_at),
  }
}
