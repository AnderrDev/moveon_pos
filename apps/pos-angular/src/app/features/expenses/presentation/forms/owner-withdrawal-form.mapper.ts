import type { RegisterOwnerWithdrawalDto } from '@angular-app/features/expenses/domain/dtos/owner-withdrawal.dto'
import type { OwnerWithdrawalFormValue } from '@angular-app/features/expenses/presentation/forms/owner-withdrawal-form.factory'

export interface OwnerWithdrawalFormContext {
  tiendaId: string
  idempotencyKey: string
}

export const ownerWithdrawalFormMapper = {
  toRegisterDto(value: OwnerWithdrawalFormValue, ctx: OwnerWithdrawalFormContext): RegisterOwnerWithdrawalDto {
    return {
      tiendaId: ctx.tiendaId,
      monto: value.monto,
      fecha: value.fecha,
      origen: value.origen,
      nota: value.nota.trim() ? value.nota.trim() : undefined,
      idempotencyKey: ctx.idempotencyKey,
    }
  },
}
