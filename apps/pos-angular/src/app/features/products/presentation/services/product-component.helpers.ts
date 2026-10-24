import type { Product } from '@angular-app/features/products/domain/entities/product.entity'
import { tracksOwnStock } from '@/shared/lib/product-type'

/**
 * Productos que pueden asignarse como componente fijo de un preparado.
 *
 * Vale cualquier producto que rastree stock propio, no solo los `ingredient`:
 * un preparado consume tanto insumos que nunca se venden sueltos (el vaso) como
 * productos `simple` que sí están en el catálogo — el cereal de un "Nutra Pops +
 * leche" se vende también por su cuenta. Restringirlo a `ingredient` dejaba esos
 * preparados sin forma de descontar nada y la venta no movía inventario.
 *
 * Se excluye lo que no rastrea stock propio (otro preparado o un combo): generaría
 * un movimiento de salida sobre un producto sin inventario. Mismo criterio que
 * `filterOptionComponentCandidates` y `filterComboItemCandidates`.
 */
export function filterComponentCandidates(
  allProducts: Product[],
  assignedIds: Set<string>,
  selfId: string | undefined,
): Product[] {
  return allProducts.filter(
    (p) => p.isActive && tracksOwnStock(p.tipo) && p.id !== selfId && !assignedIds.has(p.id),
  )
}

/**
 * Productos que puede consumir una opción de venta (ADR 0017): la proteína de un
 * batido sale de un sachet que también se vende suelto. Mismo criterio que los
 * componentes fijos — se excluye lo que no rastrea stock propio y el propio
 * producto — pero sin excluir los ya asignados: cada opción es excluyente.
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
