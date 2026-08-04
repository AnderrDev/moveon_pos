import type { Product } from '@angular-app/features/products/domain/entities/product.entity'
import { tracksOwnStock } from '@/shared/lib/product-type'

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

/**
 * Productos que puede consumir una opción de venta (ADR 0017). A diferencia de
 * los componentes fijos, aquí sí valen los `simple`: la proteína de un batido
 * sale de un sachet que también se vende suelto. Se excluyen los `prepared`
 * (no rastrean stock propio) y el propio producto.
 */
export function filterOptionComponentCandidates(
  allProducts: Product[],
  selfId: string | undefined,
): Product[] {
  return allProducts.filter((p) => p.isActive && tracksOwnStock(p.tipo) && p.id !== selfId)
}

/**
 * Productos que pueden incluirse en un combo (ADR 0018). A diferencia de los
 * componentes de un preparado, aquí lo normal es incluir productos `simple`:
 * un combo es "proteína + shaker", no "vaso + tapa".
 *
 * Se excluye todo lo que no rastrea stock propio (otro combo o un batido):
 * incluirlo generaría un movimiento de salida sobre un producto sin inventario
 * y lo dejaría en negativo sin significado.
 */
export function filterComboItemCandidates(
  allProducts: Product[],
  assignedIds: Set<string>,
  selfId: string | undefined,
): Product[] {
  return allProducts.filter(
    (p) => p.isActive && tracksOwnStock(p.tipo) && p.id !== selfId && !assignedIds.has(p.id),
  )
}
