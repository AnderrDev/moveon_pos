import type { Product } from '@angular-app/features/products/domain/entities/product.entity'

/** Productos que pueden asignarse como componente de un preparado.
 *  Solo ingredientes activos, excluyendo el propio producto y los ya asignados. */
export function filterComponentCandidates(
  allProducts: Product[],
  assignedIds: Set<string>,
  selfId: string | undefined,
): Product[] {
  return allProducts.filter(
    (p) => p.isActive && p.tipo === 'ingredient' && p.id !== selfId && !assignedIds.has(p.id),
  )
}
