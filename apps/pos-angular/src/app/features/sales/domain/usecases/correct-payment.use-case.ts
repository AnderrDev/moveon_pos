import { err, ok, type Result } from '@/shared/result'
import type { SaleRepository } from '@angular-app/features/sales/domain/repositories/sale.repository'
import { correctPaymentSchema } from '@angular-app/features/sales/domain/dtos/sale.dto'
import type { SaleValidationError } from '@angular-app/features/sales/domain/usecases/void-sale.use-case'

export interface CorrectPaymentDeps {
  repo: Pick<SaleRepository, 'correctPayment'>
  tiendaId: string
}

/** Valida y corrige el método de pago de un pago existente. Mismo contrato de errores que `voidSale`. */
export async function correctPayment(
  deps: CorrectPaymentDeps,
  input: unknown,
): Promise<Result<void, SaleValidationError>> {
  const parsed = correctPaymentSchema.safeParse(input)
  if (!parsed.success) {
    return err({
      code: 'validation',
      message: parsed.error.issues[0]?.message ?? 'Datos de corrección inválidos',
    })
  }
  await deps.repo.correctPayment(parsed.data.paymentId, deps.tiendaId, parsed.data.newMetodo, parsed.data.reason)
  return ok(undefined)
}
