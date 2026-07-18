import type { ProductRepository } from '@angular-app/features/products/domain/repositories/product.repository'
import type { TiendaId } from '@/shared/types'

export interface DeactivateProductDeps {
  repo: Pick<ProductRepository, 'deactivateProduct'>
}

/** Desactiva un producto (no lo borra — sigue visible en histórico). Seam sin validación de forma. */
export function deactivateProduct(deps: DeactivateProductDeps, id: string, tiendaId: TiendaId): Promise<void> {
  return deps.repo.deactivateProduct(id, tiendaId)
}
