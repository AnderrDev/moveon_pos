import { err, ok, type Result } from '@/shared/result'
import { entityRefSchema } from '@/shared/validations/common'
import type { ProductRepository } from '@angular-app/features/products/domain/repositories/product.repository'
import type { ProductValidationError } from '@angular-app/features/products/domain/usecases/create-product.use-case'

export interface DeactivateProductDeps {
  repo: Pick<ProductRepository, 'deactivateProduct'>
}

/**
 * Desactiva un producto (no lo borra: sigue visible en el histórico).
 * Valida los ids con Zod (`entityRefSchema`) y devuelve `Result`; los fallos
 * técnicos del repositorio se propagan como `throw`.
 */
export async function deactivateProduct(
  deps: DeactivateProductDeps,
  id: string,
  tiendaId: string,
): Promise<Result<void, ProductValidationError>> {
  const parsed = entityRefSchema.safeParse({ id, tiendaId })
  if (!parsed.success) {
    return err({ code: 'validation', message: parsed.error.issues[0]?.message ?? 'Datos inválidos' })
  }
  await deps.repo.deactivateProduct(parsed.data.id, parsed.data.tiendaId)
  return ok(undefined)
}
