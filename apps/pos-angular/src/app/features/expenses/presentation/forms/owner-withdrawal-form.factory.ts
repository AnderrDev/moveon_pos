import { z } from 'zod'
import { registerOwnerWithdrawalSchema } from '@angular-app/features/expenses/domain/dtos/owner-withdrawal.dto'
import { todayLocalDate } from '@angular-app/features/expenses/presentation/forms/expense-form.factory'

/** Schema del formulario de retiro: el DTO sin lo que pone el contexto (tienda, clave). */
export const ownerWithdrawalFormSchema = registerOwnerWithdrawalSchema
  .omit({ tiendaId: true, idempotencyKey: true })
  .extend({ nota: z.string().trim().max(200) })

export type OwnerWithdrawalFormValue = z.infer<typeof ownerWithdrawalFormSchema>

export function createOwnerWithdrawalFormDefaults(
  initial: Partial<OwnerWithdrawalFormValue> = {},
): OwnerWithdrawalFormValue {
  return {
    monto: initial.monto ?? 0,
    fecha: initial.fecha ?? todayLocalDate(),
    origen: initial.origen ?? 'banco',
    nota: initial.nota ?? '',
  }
}
