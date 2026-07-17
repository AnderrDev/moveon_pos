import type { ProductComponent } from '@angular-app/features/products/domain/repositories/product.repository'

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
