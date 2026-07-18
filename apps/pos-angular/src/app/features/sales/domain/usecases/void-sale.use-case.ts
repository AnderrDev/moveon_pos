import { err, ok, type Result } from '@/shared/result'
import type { SaleRepository } from '@angular-app/features/sales/domain/repositories/sale.repository'
import { voidSaleSchema } from '@angular-app/features/sales/domain/dtos/sale.dto'

export interface VoidSaleDeps {
  repo: Pick<SaleRepository, 'voidSale'>
  tiendaId: string
}

export interface SaleValidationError {
  code: 'validation'
  message: string
}

/**
 * Valida y anula una venta. Errores de dominio como `Result`; los fallos
 * técnicos del repositorio se propagan como `throw` (mismo patrón que
 * createCustomer/createProduct).
 */
export async function voidSale(
  deps: VoidSaleDeps,
  input: unknown,
): Promise<Result<void, SaleValidationError>> {
  const parsed = voidSaleSchema.safeParse(input)
  if (!parsed.success) {
    return err({
      code: 'validation',
      message: parsed.error.issues[0]?.message ?? 'Motivo de anulación inválido',
    })
  }
  await deps.repo.voidSale(parsed.data.saleId, deps.tiendaId, parsed.data.voidedReason)
  return ok(undefined)
}
