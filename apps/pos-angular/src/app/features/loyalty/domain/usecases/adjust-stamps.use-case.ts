import { err, ok, type Result } from '@/shared/result'
import type {
  AdjustStampsInput,
  LoyaltyRepository,
} from '@angular-app/features/loyalty/domain/repositories/loyalty.repository'
import { adjustStampsSchema } from '@angular-app/features/loyalty/domain/dtos/adjust-stamps.dto'

export interface AdjustStampsDeps {
  repo: Pick<LoyaltyRepository, 'adjustStamps'>
}

export interface LoyaltyValidationError {
  code: 'validation'
  message: string
}

/**
 * Ajuste manual de sellos para admin y cajero (RN-LF16). Valida con
 * `adjustStampsSchema` y devuelve el nuevo saldo; el RPC
 * `adjust_loyalty_stamps` re-valida en servidor (rol, tienda, motivo, delta).
 * Los fallos técnicos o rechazos del RPC se propagan como `throw`.
 */
export async function adjustStamps(
  deps: AdjustStampsDeps,
  input: AdjustStampsInput,
): Promise<Result<number, LoyaltyValidationError>> {
  const parsed = adjustStampsSchema.safeParse(input)
  if (!parsed.success) {
    return err({ code: 'validation', message: parsed.error.issues[0]?.message ?? 'Ajuste inválido' })
  }
  return ok(await deps.repo.adjustStamps(parsed.data))
}
