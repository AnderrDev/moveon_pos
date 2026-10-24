import type { OpenSessionFormValue } from './open-session-form.factory'

export const openSessionFormMapper = {
  /** El último cierre sugiere con cuánto abrir; sin sugerencia, 0. */
  toFormValue(suggestedAmount: number | null): OpenSessionFormValue {
    return { openingAmount: suggestedAmount ?? 0 }
  },

  toPayload(value: OpenSessionFormValue): { openingAmount: number } {
    return { openingAmount: value.openingAmount }
  },
}
