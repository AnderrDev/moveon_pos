import type { Product } from '@/modules/products/domain/entities/product.entity'
import type { ProductComponent } from './products.repository'

export interface ProductComponentRow {
  componente_id: string
  cantidad: string | number
  productos: { nombre: string } | null
}

export function rowToProductComponent(row: ProductComponentRow): ProductComponent {
  return {
    componenteId: row.componente_id,
    componenteNombre: row.productos?.nombre ?? '',
    cantidad: Number(row.cantidad),
  }
}

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

/** Construye las filas a insertar en product_components. */
export function buildComponentInsertRows(
  productId: string,
  tiendaId: string,
  components: { componenteId: string; cantidad: number }[],
): Record<string, unknown>[] {
  return components.map((c) => ({
    tienda_id: tiendaId,
    producto_id: productId,
    componente_id: c.componenteId,
    cantidad: c.cantidad,
  }))
}
