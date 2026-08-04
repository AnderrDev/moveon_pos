/**
 * Servicio de dominio puro (TS, sin Angular/Supabase/DOM).
 *
 * Decide si un producto debe marcarse como "Stock bajo".
 *
 * Regla de negocio: los productos que no llevan stock propio nunca se
 * consideran en bajo stock ni agotados — los batidos (`prepared`), que se
 * elaboran al momento a partir de ingredientes, y los combos (`combo`), cuya
 * disponibilidad depende de los productos incluidos. El resto de tipos
 * (`simple`, `ingredient`) están bajos cuando su stock actual es menor o igual
 * al mínimo configurado.
 *
 * Esta es la única fuente de verdad de la regla; la reutilizan el repositorio
 * de inventario, la página de inventario y el reporte de stock.
 */

import type { ProductType } from '@/shared/types'
import { tracksOwnStock } from '@/shared/lib/product-type'

/**
 * @param tipo          Tipo de producto.
 * @param currentStock  Stock actual.
 * @param minimumStock  Stock mínimo configurado.
 * @returns `true` si el producto está en bajo stock; `false` si no lleva stock propio.
 */
export function isLowStock(params: {
  tipo: ProductType
  currentStock: number
  minimumStock: number
}): boolean {
  if (!tracksOwnStock(params.tipo)) return false
  return params.currentStock <= params.minimumStock
}

/**
 * Decide si un producto debe marcarse como "Agotado" (sin stock disponible
 * en punto de venta). Misma exclusión que `isLowStock`: los preparados y los
 * combos no llevan stock propio, por lo que nunca están agotados.
 *
 * @param tipo          Tipo de producto.
 * @param currentStock  Stock actual.
 * @returns `true` si el producto está agotado; `false` si no lleva stock propio.
 */
export function isOutOfStock(params: { tipo: ProductType; currentStock: number }): boolean {
  if (!tracksOwnStock(params.tipo)) return false
  return params.currentStock <= 0
}
