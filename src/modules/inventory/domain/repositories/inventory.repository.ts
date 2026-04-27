import type { Result } from '@/shared/result'
import type { TiendaId, UserId } from '@/shared/types'
import type { InventoryMovement, StockLevel } from '../entities/inventory.entity'

export interface RegisterEntryParams {
  tiendaId: TiendaId
  productId: string
  cantidad: number
  costoUnitario?: number
  motivo?: string
  createdBy: UserId
}

export interface AdjustStockParams {
  tiendaId: TiendaId
  productId: string
  cantidadDelta: number
  motivo: string
  createdBy: UserId
}

export interface InventoryRepository {
  getStock(productId: string, tiendaId: TiendaId): Promise<Result<number>>
  getStockLevels(tiendaId: TiendaId): Promise<Result<StockLevel[]>>
  getKardex(productId: string, tiendaId: TiendaId, limit?: number): Promise<Result<InventoryMovement[]>>
  registerEntry(params: RegisterEntryParams): Promise<Result<InventoryMovement>>
  adjustStock(params: AdjustStockParams): Promise<Result<InventoryMovement>>
}
