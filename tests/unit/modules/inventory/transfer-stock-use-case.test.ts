import { describe, expect, it } from 'vitest'
import {
  transferStockUseCase,
  type TransferStockUseCaseInput,
} from '@/modules/inventory/application/use-cases/transfer-stock.use-case'
import type { InventoryRepository } from '@/modules/inventory/domain/repositories/inventory.repository'
import { err, ok } from '@/shared/result'

const input: TransferStockUseCaseInput = {
  tiendaId: 'tienda-1',
  productId: 'product-1',
  fromUbicacion: 'bodega',
  toUbicacion: 'punto_venta',
  cantidad: 3,
  motivo: 'Reposicion mostrador',
  createdBy: 'user-1',
}

function makeRepository(): InventoryRepository {
  return {
    getStock: async () => ok(0),
    getStockLevels: async () => ok([]),
    getKardex: async () => ok([]),
    registerEntry: async () => err(new Error('not implemented')),
    adjustStock: async () => err(new Error('not implemented')),
    transferStock: async () => ok('transfer-1'),
  }
}

describe('transferStockUseCase', () => {
  it('delegates valid transfers to the repository', async () => {
    const result = await transferStockUseCase(input, { inventoryRepository: makeRepository() })

    expect(result).toEqual(ok('transfer-1'))
  })

  it('rejects equal origin and destination', async () => {
    const result = await transferStockUseCase(
      { ...input, toUbicacion: 'bodega' },
      { inventoryRepository: makeRepository() },
    )

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.message).toBe('El origen y destino deben ser diferentes')
  })

  it('rejects non-positive quantities', async () => {
    const result = await transferStockUseCase(
      { ...input, cantidad: 0 },
      { inventoryRepository: makeRepository() },
    )

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.message).toBe('La cantidad debe ser mayor a 0')
  })
})
