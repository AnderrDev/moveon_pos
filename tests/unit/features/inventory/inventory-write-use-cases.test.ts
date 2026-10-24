import { describe, expect, it } from 'vitest'
import { registerEntry } from '@angular-app/features/inventory/domain/usecases/register-entry.use-case'
import { adjustStock } from '@angular-app/features/inventory/domain/usecases/adjust-stock.use-case'
import { transferStock } from '@angular-app/features/inventory/domain/usecases/transfer-stock.use-case'
import { correctEntryCost } from '@angular-app/features/inventory/domain/usecases/correct-entry-cost.use-case'
import type { InventoryMovement } from '@angular-app/features/inventory/domain/entities/inventory.entity'

const tiendaId = '11111111-1111-4111-8111-111111111111'
const productId = '22222222-2222-4222-8222-222222222222'
const now = new Date('2026-07-17T00:00:00.000Z')

const movement: InventoryMovement = {
  id: 'movimiento-1',
  tiendaId,
  productId,
  tipo: 'entry',
  ubicacion: 'bodega',
  cantidad: 10,
  costoUnitario: 5_000,
  motivo: null,
  metodoPago: null,
  referenciaTipo: null,
  referenciaId: null,
  createdBy: 'user-1',
  createdAt: now,
}

describe('registerEntry', () => {
  it('registra la entrada cuando los datos son válidos', async () => {
    const repo = { registerEntry: async () => movement }
    const result = await registerEntry(
      { repo, tiendaId, createdBy: 'user-1' },
      { productId, cantidad: 10, ubicacion: 'bodega' }
    )
    expect(result).toEqual({ ok: true, value: movement })
  })

  it('rechaza cantidad no positiva sin llamar al repositorio', async () => {
    let called = false
    const repo = {
      registerEntry: async () => {
        called = true
        return movement
      },
    }
    const result = await registerEntry(
      { repo, tiendaId, createdBy: 'user-1' },
      { productId, cantidad: 0, ubicacion: 'bodega' }
    )
    expect(result.ok).toBe(false)
    expect(called).toBe(false)
  })
})

describe('adjustStock', () => {
  it('registra el ajuste cuando los datos son válidos', async () => {
    const repo = { adjustStock: async () => movement }
    const result = await adjustStock(
      { repo, tiendaId, createdBy: 'user-1' },
      { productId, cantidadDelta: -2, ubicacion: 'punto_venta', motivo: 'Conteo físico' }
    )
    expect(result).toEqual({ ok: true, value: movement })
  })

  it('rechaza delta cero sin llamar al repositorio', async () => {
    let called = false
    const repo = {
      adjustStock: async () => {
        called = true
        return movement
      },
    }
    const result = await adjustStock(
      { repo, tiendaId, createdBy: 'user-1' },
      { productId, cantidadDelta: 0, ubicacion: 'punto_venta', motivo: 'Conteo físico' }
    )
    expect(result.ok).toBe(false)
    expect(called).toBe(false)
  })
})

describe('correctEntryCost', () => {
  it('delega una corrección válida con el contexto autenticado', async () => {
    let received: unknown
    const repo = {
      correctEntryCost: async (input: unknown) => {
        received = input
        return { ...movement, costoUnitario: 22_000 }
      },
    }
    const result = await correctEntryCost(
      { repo, tiendaId, correctedBy: 'user-1' },
      {
        movementId: '33333333-3333-4333-8333-333333333333',
        newCost: 22_000,
        updateProductCost: true,
        reason: 'La factura tenía otro costo unitario',
      }
    )

    expect(result.ok).toBe(true)
    expect(received).toEqual({
      movementId: '33333333-3333-4333-8333-333333333333',
      tiendaId,
      newCost: 22_000,
      updateProductCost: true,
      correctedBy: 'user-1',
      reason: 'La factura tenía otro costo unitario',
    })
  })

  it('rechaza la corrección inválida sin llamar al repositorio', async () => {
    let called = false
    const repo = {
      correctEntryCost: async () => {
        called = true
        return movement
      },
    }
    const result = await correctEntryCost(
      { repo, tiendaId, correctedBy: 'user-1' },
      {
        movementId: '33333333-3333-4333-8333-333333333333',
        newCost: 0,
        updateProductCost: true,
        reason: 'corto',
      }
    )

    expect(result.ok).toBe(false)
    expect(called).toBe(false)
  })
})

describe('transferStock', () => {
  it('traslada el stock cuando los datos son válidos', async () => {
    const repo = { transferStock: async () => movement.id }
    const result = await transferStock(
      { repo, tiendaId, createdBy: 'user-1' },
      {
        productId,
        fromUbicacion: 'bodega',
        toUbicacion: 'punto_venta',
        cantidad: 5,
        motivo: 'Reposición al punto de venta',
      }
    )
    expect(result).toEqual({ ok: true, value: movement.id })
  })

  it('rechaza origen igual a destino sin llamar al repositorio', async () => {
    let called = false
    const repo = {
      transferStock: async () => {
        called = true
        return movement.id
      },
    }
    const result = await transferStock(
      { repo, tiendaId, createdBy: 'user-1' },
      {
        productId,
        fromUbicacion: 'bodega',
        toUbicacion: 'bodega',
        cantidad: 5,
        motivo: 'Reposición al punto de venta',
      }
    )
    expect(result.ok).toBe(false)
    expect(called).toBe(false)
  })
})
