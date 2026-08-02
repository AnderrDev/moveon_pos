import type { InventoryLocation } from '@/shared/types'
import type { InventoryMovement, StockLevel } from '@angular-app/features/inventory/domain/entities/inventory.entity'

export interface RegisterEntryInput {
  tiendaId: string
  productId: string
  productName?: string
  cantidad: number
  ubicacion: InventoryLocation
  costoUnitario?: number
  motivo?: string
  createdBy: string
}

export interface AdjustStockInput {
  tiendaId: string
  productId: string
  productName?: string
  cantidadDelta: number
  ubicacion: InventoryLocation
  motivo: string
  createdBy: string
}

export interface TransferStockInput {
  tiendaId: string
  productId: string
  productName?: string
  fromUbicacion: InventoryLocation
  toUbicacion: InventoryLocation
  cantidad: number
  motivo: string
  createdBy: string
}

/**
 * Contrato de persistencia de inventario. Abstract class (ADR 0015 §6.1).
 * Reescrito desde el uso real (2026-07-17): la interfaz previa envolvía todo
 * en `Result<T>`; la implementación real lanza (`throw`) y no lo hacía.
 */
export abstract class InventoryRepository {
  abstract getStock(productId: string, tiendaId: string, ubicacion?: InventoryLocation): Promise<number>
  abstract getStockLevels(tiendaId: string): Promise<StockLevel[]>
  abstract getKardex(productId: string, tiendaId: string, limit?: number): Promise<InventoryMovement[]>
  abstract registerEntry(input: RegisterEntryInput): Promise<InventoryMovement>
  abstract adjustStock(input: AdjustStockInput): Promise<InventoryMovement>
  abstract transferStock(input: TransferStockInput): Promise<string>
}
