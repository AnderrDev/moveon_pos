import type { InventoryLocation } from '@/shared/types'
import type { StockMovementRecord } from '@angular-app/features/inventory/domain/services/purchase-suggestions'
import type { EntryPaymentMethod } from '@angular-app/features/inventory/domain/entities/inventory.entity'
import type {
  InventoryMovement,
  StockLevel,
} from '@angular-app/features/inventory/domain/entities/inventory.entity'

export interface RegisterEntryInput {
  tiendaId: string
  productId: string
  productName?: string
  cantidad: number
  ubicacion: InventoryLocation
  costoUnitario?: number
  motivo?: string
  metodoPago?: EntryPaymentMethod
  createdBy: string
}

export interface SplitProductInput {
  tiendaId: string
  origenId: string
  cantidadOrigen: number
  destinoId: string
  cantidadDestino: number
  ubicacion: InventoryLocation
  nota?: string
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

export interface CorrectEntryCostInput {
  movementId: string
  tiendaId: string
  newCost: number
  updateProductCost: boolean
  correctedBy: string
  reason: string
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
  abstract getStock(
    productId: string,
    tiendaId: string,
    ubicacion?: InventoryLocation
  ): Promise<number>
  abstract getStockLevels(tiendaId: string): Promise<StockLevel[]>
  /**
   * Todos los movimientos desde `fromIso` (cantidad con signo). El asesor de
   * compras reconstruye con ellos el consumo y el stock al cierre de cada día.
   */
  abstract getMovementsSince(tiendaId: string, fromIso: string): Promise<StockMovementRecord[]>
  abstract getKardex(
    productId: string,
    tiendaId: string,
    limit?: number
  ): Promise<InventoryMovement[]>
  abstract registerEntry(input: RegisterEntryInput): Promise<InventoryMovement>
  abstract correctEntryCost(input: CorrectEntryCostInput): Promise<InventoryMovement>
  abstract adjustStock(input: AdjustStockInput): Promise<InventoryMovement>
  /** Fraccionar (PLAN-113): devuelve el movimiento de entrada del destino. */
  abstract splitProduct(input: SplitProductInput): Promise<InventoryMovement>
  abstract transferStock(input: TransferStockInput): Promise<string>
}
