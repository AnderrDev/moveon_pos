import type { ProductRepository } from '@angular-app/features/products/domain/repositories/product.repository'
import type { TiendaId } from '@/shared/types'

export interface DeactivateCategoriaDeps {
  repo: Pick<ProductRepository, 'deactivateCategoria'>
}

/** Desactiva una categoría. Seam sin validación de forma. */
export function deactivateCategoria(deps: DeactivateCategoriaDeps, id: string, tiendaId: TiendaId): Promise<void> {
  return deps.repo.deactivateCategoria(id, tiendaId)
}
