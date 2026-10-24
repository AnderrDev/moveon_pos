import type { CashMovementType } from '@/shared/types'
import type { AddMovementFormValue } from './add-movement-form.factory'

export const addMovementFormMapper = {
  toPayload(value: AddMovementFormValue): { tipo: CashMovementType; amount: number; motivo: string } {
    return { tipo: value.tipo, amount: value.amount, motivo: value.motivo }
  },
}
