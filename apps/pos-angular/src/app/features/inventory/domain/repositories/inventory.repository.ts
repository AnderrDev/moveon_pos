import type { Result } from '@/shared/result'
import type { InventoryLocation, TiendaId, UserId } from '@/shared/types'
import type { InventoryMovement, StockLevel } from '@angular-app/features/inventory/domain/entities/inventory.entity'

export interface RegisterEntryParams {
  tiendaId: TiendaId
  productId: string
  cantidad: number
  ubicacion: InventoryLocation
  costoUnitario?: number
  motivo?: string
  createdBy: UserId
}

export interface AdjustStockParams {
  tiendaId: TiendaId
  productId: string
  cantidadDelta: number
  ubicacion: InventoryLocation
  motivo: string
  createdBy: UserId
}

export interface TransferStockParams {
  tiendaId: TiendaId
  productId: string
  fromUbicacion: InventoryLocation
  toUbicacion: InventoryLocation
  cantidad: number
  motivo: string
  createdBy: UserId
}

export interface InventoryRepository {
  getStock(productId: string, tiendaId: TiendaId, ubicacion?: InventoryLocation): Promise<Result<number>>
  getStockLevels(tiendaId: TiendaId): Promise<Result<StockLevel[]>>
  getKardex(productId: string, tiendaId: TiendaId, limit?: number): Promise<Result<InventoryMovement[]>>
  registerEntry(params: RegisterEntryParams): Promise<Result<InventoryMovement>>
  adjustStock(params: AdjustStockParams): Promise<Result<InventoryMovement>>
  transferStock(params: TransferStockParams): Promise<Result<string>>
}
