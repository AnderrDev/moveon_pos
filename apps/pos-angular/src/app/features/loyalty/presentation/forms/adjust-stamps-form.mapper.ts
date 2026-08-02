import type { AdjustStampsFormValue } from '@angular-app/features/loyalty/presentation/forms/adjust-stamps-form.factory'

export interface AdjustStampsContext {
  tiendaId: string
  clienteId: string
  createdBy: string
}

export interface AdjustStampsPayload {
  tiendaId: string
  clienteId: string
  delta: number
  reason: string
  createdBy: string
}

export const adjustStampsFormMapper = {
  toPayload(value: AdjustStampsFormValue, ctx: AdjustStampsContext): AdjustStampsPayload {
    return {
      tiendaId: ctx.tiendaId,
      clienteId: ctx.clienteId,
      delta: value.delta,
      reason: value.reason.trim(),
      createdBy: ctx.createdBy,
    }
  },
}
