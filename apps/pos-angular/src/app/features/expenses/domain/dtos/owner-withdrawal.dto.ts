import { z } from 'zod'
import { VOID_EXPENSE_REASON_MIN_LENGTH } from '@angular-app/features/expenses/domain/dtos/expense.dto'

export const OWNER_WITHDRAWAL_NOTE_MAX = 200

export const ownerWithdrawalOrigenSchema = z.enum(['caja', 'banco'])

export const registerOwnerWithdrawalSchema = z.object({
  tiendaId: z.string().uuid(),
  monto: z.number().int('El monto debe ser un valor entero en pesos').positive('El monto debe ser mayor a 0'),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (se espera YYYY-MM-DD)'),
  origen: ownerWithdrawalOrigenSchema,
  nota: z.string().trim().max(OWNER_WITHDRAWAL_NOTE_MAX).optional(),
  /** Una por apertura del diálogo: un reintento devuelve el retiro ya registrado. */
  idempotencyKey: z.string().min(1).max(100).optional(),
})

export type RegisterOwnerWithdrawalDto = z.infer<typeof registerOwnerWithdrawalSchema>

export const voidOwnerWithdrawalSchema = z.object({
  withdrawalId: z.string().uuid(),
  tiendaId: z.string().uuid(),
  motivo: z
    .string()
    .trim()
    .min(
      VOID_EXPENSE_REASON_MIN_LENGTH,
      `El motivo debe tener al menos ${VOID_EXPENSE_REASON_MIN_LENGTH} caracteres`,
    )
    .max(300),
})

export type VoidOwnerWithdrawalDto = z.infer<typeof voidOwnerWithdrawalSchema>
