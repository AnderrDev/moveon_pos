import type { ProductRepository } from '@angular-app/features/products/domain/repositories/product.repository'
import type { TiendaId } from '@/shared/types'

export interface SaveProductComponentsDeps {
  repo: Pick<ProductRepository, 'saveComponents'>
}

/**
 * Reemplaza los componentes consumibles de un producto `prepared` (ej. vaso,
 * ingredientes de un batido). Seam sin validación de forma — la UI ya
 * restringe la selección a ingredientes activos (`filterComponentCandidates`).
 */
export function saveProductComponents(
  deps: SaveProductComponentsDeps,
  productId: string,
  tiendaId: TiendaId,
  components: { componenteId: string; cantidad: number }[],
): Promise<void> {
  return deps.repo.saveComponents(productId, tiendaId, components)
}
