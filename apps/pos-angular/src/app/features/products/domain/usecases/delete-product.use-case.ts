import type { ProductRepository } from '@angular-app/features/products/domain/repositories/product.repository'
import type { TiendaId } from '@/shared/types'

export interface DeleteProductDeps {
  repo: Pick<ProductRepository, 'deleteProduct'>
}

/** Borrado lógico (soft-delete vía `deleted_at`). Seam sin validación de forma. */
export function deleteProduct(deps: DeleteProductDeps, id: string, tiendaId: TiendaId): Promise<void> {
  return deps.repo.deleteProduct(id, tiendaId)
}
