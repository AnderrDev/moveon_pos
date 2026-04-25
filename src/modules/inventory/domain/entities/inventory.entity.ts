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
  type: InventoryMovementType
  quantity: number
  previousStock: number
  newStock: number
  reason: string | null
  referenceId: string | null
  createdBy: UserId
  createdAt: Date
}
