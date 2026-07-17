import { describe, expect, it } from 'vitest'
import { rowToInventoryMovement } from '@angular-app/features/inventory/data/models/inventory.mapper'

describe('rowToInventoryMovement', () => {
  it('mapea la ubicación del movimiento de inventario', () => {
    const movement = rowToInventoryMovement({
      id: 'movement-1',
      tienda_id: 'tienda-1',
      producto_id: 'product-1',
      tipo: 'transfer_in',
      ubicacion: 'punto_venta',
      cantidad: 4,
      costo_unitario: null,
      motivo: 'Reposicion mostrador',
      referencia_tipo: 'transfer',
      referencia_id: '11111111-1111-4111-8111-111111111111',
      created_by: 'user-1',
      created_at: '2026-05-29T10:00:00.000Z',
    })

    expect(movement).toMatchObject({
      tipo: 'transfer_in',
      ubicacion: 'punto_venta',
      cantidad: 4,
      motivo: 'Reposicion mostrador',
    })
  })
})
