/**
 * Servicio de dominio puro (TS, sin Angular/Supabase/DOM).
 *
 * Decide si un producto debe marcarse como "Stock bajo".
 *
 * Regla de negocio: los productos preparados (`tipo === 'prepared'`) son
 * batidos que se elaboran al momento a partir de ingredientes; no llevan stock
 * propio gestionable, por lo que NUNCA se consideran en bajo stock. El resto de
 * tipos (`simple`, `ingredient`) están bajos cuando su stock actual es menor o
 * igual al mínimo configurado.
 *
 * Esta es la única fuente de verdad de la regla; la reutilizan el repositorio
 * de inventario, la página de inventario y el reporte de stock.
 */

import type { ProductType } from '@/shared/types'

/**
 * @param tipo          Tipo de producto (`'simple' | 'prepared' | 'ingredient'`).
 * @param currentStock  Stock actual.
 * @param minimumStock  Stock mínimo configurado.
 * @returns `true` si el producto está en bajo stock; `false` para preparados.
 */
export function isLowStock(params: {
  tipo: ProductType
  currentStock: number
  minimumStock: number
}): boolean {
  if (params.tipo === 'prepared') return false
  return params.currentStock <= params.minimumStock
}
