import type { InventoryMovementType, TiendaId, UserId } from '@/shared/types'

export interface StockLevel {
  productId: string
  tiendaId: TiendaId
  currentStock: number
  minimumStock: number
  isLow: boolean
}

export interface InventoryMovement {
  id: string
  tiendaId: TiendaId
  productId: string
  tipo: InventoryMovementType
  cantidad: number
  costoUnitario: number | null
  motivo: string | null
  referenciaTipo: string | null
  referenciaId: string | null
  createdBy: UserId
  createdAt: Date
}
