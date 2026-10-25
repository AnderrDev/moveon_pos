import type { ProductType } from '@/shared/types'
import { tracksOwnStock } from '@/shared/lib/product-type'
import type { StockLevel } from '@angular-app/features/inventory/domain/entities/inventory.entity'

/**
 * Valor del inventario al costo: Σ stock (bodega + punto de venta) × costo
 * vigente del producto. Servicio de dominio puro. Preparados y combos no
 * llevan stock propio y no suman; el stock negativo cuenta como cero.
 */
export interface StockValuation {
  valorAlCosto: number
  /** Productos con stock pero sin costo registrado: no suman al valor. */
  productosSinCosto: number
}

export function valueStockAtCost(
  levels: readonly Pick<StockLevel, 'productId' | 'totalStock'>[],
  products: readonly { id: string; tipo: ProductType; costo: number | null }[],
): StockValuation {
  const byId = new Map(products.map((p) => [p.id, p]))
  let valorAlCosto = 0
  let productosSinCosto = 0
  for (const level of levels) {
    const product = byId.get(level.productId)
    if (!product || !tracksOwnStock(product.tipo)) continue
    const units = Math.max(level.totalStock, 0)
    if (units === 0) continue
    if (product.costo === null) {
      productosSinCosto++
      continue
    }
    valorAlCosto += units * product.costo
  }
  return { valorAlCosto: Math.round(valorAlCosto), productosSinCosto }
}
