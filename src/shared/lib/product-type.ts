import type { ProductType } from '@/shared/types'

/**
 * Tipos de producto que NO rastrean stock propio: lo que se descuenta del
 * inventario al venderlos son los productos que los componen
 * (`product_components`), no ellos mismos.
 *
 * - `prepared` — batidos: consumen vaso, sachet de proteína, etc. (ADR 0017).
 * - `combo`    — promociones: consumen los productos incluidos (ADR 0018).
 *
 * Es el espejo en TypeScript del guarda `tipo not in ('prepared','combo')` que
 * usan `create_sale_atomic`, `void_sale_atomic` y `tg_consume_sale_components`.
 * Si aquí y allá dejan de coincidir, el POS mostraría un stock que el servidor
 * no valida.
 */
const STOCKLESS_PRODUCT_TYPES: readonly ProductType[] = ['prepared', 'combo']

/** `true` si el producto lleva stock propio en `inventory_movements`. */
export function tracksOwnStock(tipo: ProductType): boolean {
  return !STOCKLESS_PRODUCT_TYPES.includes(tipo)
}
