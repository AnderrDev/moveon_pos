import { err, ok, type Result } from '@/shared/result'
import type { SaleRepository } from '@angular-app/features/sales/domain/repositories/sale.repository'
import { correctSaleCustomerSchema } from '@angular-app/features/sales/domain/dtos/sale.dto'
import type { SaleValidationError } from '@angular-app/features/sales/domain/usecases/void-sale.use-case'

export interface CorrectSaleCustomerDeps {
  repo: Pick<SaleRepository, 'correctSaleCustomer'>
  tiendaId: string
}

/**
 * Asocia retroactivamente un cliente a una venta que se completó sin
 * cliente. Si el producto participaba en fidelización, el RPC otorga los
 * sellos correspondientes en la misma transacción. Mismo contrato de
 * errores que `voidSale`/`correctPayment`.
 */
export async function correctSaleCustomer(
  deps: CorrectSaleCustomerDeps,
  input: unknown,
): Promise<Result<void, SaleValidationError>> {
  const parsed = correctSaleCustomerSchema.safeParse(input)
  if (!parsed.success) {
    return err({
      code: 'validation',
      message: parsed.error.issues[0]?.message ?? 'Datos de corrección inválidos',
    })
  }
  await deps.repo.correctSaleCustomer(
    parsed.data.saleId,
    deps.tiendaId,
    parsed.data.clienteId,
    parsed.data.reason,
  )
  return ok(undefined)
}
