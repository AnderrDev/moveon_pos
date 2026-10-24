import type { CashSession } from '@angular-app/features/cash-register/domain/entities/cash-session.entity'
import type { CorrectOpeningFormValue } from './correct-opening-form.factory'

export const correctOpeningFormMapper = {
  toFormValue(session: CashSession | null): CorrectOpeningFormValue {
    return { newAmount: session?.openingAmount ?? 0, reason: '' }
  },

  toPayload(value: CorrectOpeningFormValue, sessionId: string) {
    return { sessionId, newAmount: value.newAmount, reason: value.reason }
  },
}
