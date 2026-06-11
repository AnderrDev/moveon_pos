import { err, type Result } from '@/shared/result'
import type { InventoryLocation, TiendaId, UserId } from '@/shared/types'
import type { InventoryRepository } from '../../domain/repositories/inventory.repository'

export interface TransferStockUseCaseInput {
  tiendaId: TiendaId
  productId: string
  fromUbicacion: InventoryLocation
  toUbicacion: InventoryLocation
  cantidad: number
  motivo: string
  createdBy: UserId
}

export interface TransferStockUseCaseDeps {
  inventoryRepository: InventoryRepository
}

export async function transferStockUseCase(
  input: TransferStockUseCaseInput,
  deps: TransferStockUseCaseDeps,
): Promise<Result<string>> {
  if (input.fromUbicacion === input.toUbicacion) {
    return err(new Error('El origen y destino deben ser diferentes'))
  }

  if (input.cantidad <= 0) {
    return err(new Error('La cantidad debe ser mayor a 0'))
  }

  return deps.inventoryRepository.transferStock(input)
}
