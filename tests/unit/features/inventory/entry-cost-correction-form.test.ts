import { describe, expect, it } from 'vitest'
import type { InventoryMovement } from '@angular-app/features/inventory/domain/entities/inventory.entity'
import {
  createEntryCostCorrectionDefaults,
  entryCostCorrectionFormSchema,
} from '@angular-app/features/inventory/presentation/forms/entry-cost-correction-form.factory'
import { entryCostCorrectionFormMapper } from '@angular-app/features/inventory/presentation/forms/entry-cost-correction-form.mapper'

const movement: InventoryMovement = {
  id: '33333333-3333-4333-8333-333333333333',
  tiendaId: '11111111-1111-4111-8111-111111111111',
  productId: '22222222-2222-4222-8222-222222222222',
  tipo: 'entry',
  ubicacion: 'bodega',
  cantidad: 10,
  costoUnitario: 20_000,
  motivo: 'Compra proveedor',
  referenciaTipo: null,
  referenciaId: null,
  createdBy: '44444444-4444-4444-8444-444444444444',
  createdAt: new Date('2026-08-14T12:00:00.000Z'),
}

describe('entryCostCorrectionForm', () => {
  it('crea defaults seguros', () => {
    expect(createEntryCostCorrectionDefaults()).toEqual({
      newCost: 0,
      updateProductCost: false,
      reason: '',
    })
  })

  it('precarga el costo y marca actualización para la entrada más reciente', () => {
    expect(entryCostCorrectionFormMapper.toFormValue(movement, true)).toEqual({
      newCost: 20_000,
      updateProductCost: true,
      reason: '',
    })
  })

  it('mapea y normaliza el payload', () => {
    expect(
      entryCostCorrectionFormMapper.toPayload(
        {
          newCost: 22_000,
          updateProductCost: false,
          reason: '  Corrige el costo de una factura  ',
        },
        movement.id
      )
    ).toEqual({
      movementId: movement.id,
      newCost: 22_000,
      updateProductCost: false,
      reason: 'Corrige el costo de una factura',
    })
  })

  it('valida costo positivo y motivo descriptivo', () => {
    expect(
      entryCostCorrectionFormSchema.safeParse({
        newCost: 22_000,
        updateProductCost: true,
        reason: 'Costo corregido desde la factura',
      }).success
    ).toBe(true)
    expect(
      entryCostCorrectionFormSchema.safeParse({
        newCost: 0,
        updateProductCost: true,
        reason: 'corto',
      }).success
    ).toBe(false)
  })
})
