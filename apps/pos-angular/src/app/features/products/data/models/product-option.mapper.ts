import type { ProductOption } from '@angular-app/features/products/domain/repositories/product.repository'

export interface ProductOptionRow {
  id: string
  grupo: string
  nombre: string
  precio_extra: string | number
  componente_id: string | null
  componente_cantidad: string | number
  es_default: boolean
  orden: number
  is_active: boolean
  productos: { nombre: string } | null
}

export function rowToProductOption(row: ProductOptionRow): ProductOption {
  return {
    id: row.id,
    grupo: row.grupo,
    nombre: row.nombre,
    precioExtra: Number(row.precio_extra),
    componenteId: row.componente_id,
    componenteNombre: row.productos?.nombre ?? '',
    componenteCantidad: Number(row.componente_cantidad),
    esDefault: row.es_default,
  }
}

/**
 * Filas para upsert en `product_options`. La clave natural es
 * (producto_id, grupo, nombre): al guardar se actualiza la fila existente en
 * vez de borrarla e insertarla de nuevo, para no romper el `option_id` que las
 * ventas pasadas ya referencian (ADR 0017 §2.2).
 */
export function buildOptionUpsertRows(
  productId: string,
  tiendaId: string,
  options: ProductOption[],
): Record<string, unknown>[] {
  return options.map((option, index) => ({
    tienda_id: tiendaId,
    producto_id: productId,
    grupo: option.grupo,
    nombre: option.nombre,
    precio_extra: option.precioExtra,
    componente_id: option.componenteId,
    componente_cantidad: option.componenteId ? option.componenteCantidad : 0,
    es_default: option.esDefault,
    orden: index,
    is_active: true,
  }))
}
