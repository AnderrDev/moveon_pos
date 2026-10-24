import type { CashMovement } from '@angular-app/features/cash-register/domain/entities/cash-session.entity'
import type { CorrectMovementFormValue } from './correct-movement-form.factory'

export const correctMovementFormMapper = {
  /** Arranca con lo registrado; el motivo de la corrección siempre vacío. */
  toFormValue(movement: CashMovement | null): CorrectMovementFormValue {
    return { newAmount: movement?.amount ?? 0, newMotivo: movement?.motivo ?? '', reason: '' }
  },

  toPayload(value: CorrectMovementFormValue, movementId: string) {
    return { movementId, newAmount: value.newAmount, newMotivo: value.newMotivo, reason: value.reason }
  },
}
