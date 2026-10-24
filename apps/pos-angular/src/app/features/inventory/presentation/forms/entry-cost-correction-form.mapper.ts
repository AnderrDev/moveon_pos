import type { InventoryMovement } from '@angular-app/features/inventory/domain/entities/inventory.entity'
import type { EntryCostCorrectionFormValue } from './entry-cost-correction-form.factory'

export interface EntryCostCorrectionPayload {
  movementId: string
  newCost: number
  updateProductCost: boolean
  reason: string
}

export const entryCostCorrectionFormMapper = {
  toFormValue(
    movement: InventoryMovement,
    updateProductCost: boolean
  ): EntryCostCorrectionFormValue {
    return {
      newCost: movement.costoUnitario ?? 0,
      updateProductCost,
      reason: '',
    }
  },

  toPayload(value: EntryCostCorrectionFormValue, movementId: string): EntryCostCorrectionPayload {
    return {
      movementId,
      newCost: value.newCost,
      updateProductCost: value.updateProductCost,
      reason: value.reason.trim(),
    }
  },
}
