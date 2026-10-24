import { describe, expect, it } from 'vitest'
import type { InventoryMovement } from '@angular-app/features/inventory/domain/entities/inventory.entity'
import { buildKardexWorkbook } from '@angular-app/features/inventory/presentation/services/inventory-export'

describe('buildKardexWorkbook', () => {
  it('exporta el costo unitario de la entrada', () => {
    const movement: InventoryMovement = {
      id: 'movement-1',
      tiendaId: 'store-1',
      productId: 'product-1',
      tipo: 'entry',
      ubicacion: 'bodega',
      cantidad: 10,
      costoUnitario: 22_000,
      motivo: 'Compra proveedor',
      referenciaTipo: null,
      referenciaId: null,
      createdBy: 'user-1',
      createdAt: new Date('2026-08-14T12:00:00.000Z'),
    }

    const workbook = buildKardexWorkbook('Proteína', [movement])
    expect(workbook.sheets[0]?.rows[0]?.[4]).toBe(22_000)
  })
})
