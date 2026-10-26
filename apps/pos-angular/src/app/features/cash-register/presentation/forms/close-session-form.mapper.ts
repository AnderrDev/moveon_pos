import type { CloseSessionFormValue } from './close-session-form.factory'

export interface CloseSessionPayload {
  actualCashAmount: number
  cashLeftAmount: number
  actualTransferAmount: number
  actualCardAmount: number
  notasCierre?: string
}

export const closeSessionFormMapper = {
  toPayload(value: CloseSessionFormValue): CloseSessionPayload {
    const notasCierre = value.notasCierre.trim()
    return {
      actualCashAmount: value.actualCashAmount,
      cashLeftAmount: value.withdrawAtClose
        ? value.cashLeftAmount
        : value.actualCashAmount,
      actualTransferAmount: value.actualTransferAmount,
      actualCardAmount: value.actualCardAmount,
      notasCierre: notasCierre || undefined,
    }
  },
}
