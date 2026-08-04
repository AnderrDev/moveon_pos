/**
 * Disponibilidad de un combo (ADR 0018).
 *
 * Un combo no tiene stock propio: cuántos se pueden vender lo dicta el producto
 * incluido más escaso. `min(floor(stock / cantidad))` sobre todos los incluidos.
 *
 * El servidor NO bloquea la venta por falta de componentes — la política es
 * advertir, no bloquear, igual que con los batidos (ADR 0017 §2.4). Este cálculo
 * es el que hace visible el límite en el POS y lo que topa la cantidad del
 * carrito vía `stock-cap.ts`. Si el caché de productos está desactualizado, el
 * stock de un componente puede terminar en negativo; queda visible en
 * inventario, no silencioso.
 */

/** Producto incluido en el combo, con el stock actual del componente. */
export interface ComboComponentStock {
  cantidad: number
  /** Stock disponible del componente en punto de venta. */
  stockDisponible: number
}

/**
 * @returns Cuántas unidades del combo se pueden armar. `0` si algún componente
 *   está agotado. Un combo sin componentes devuelve `0`: no se puede armar nada
 *   y venderlo no descontaría inventario.
 */
export function deriveComboStock(components: ComboComponentStock[]): number {
  // `cantidad > 0` lo garantiza un check en `product_components`; el filtro es
  // defensivo para no dividir por cero si llegara una fila corrupta.
  const validos = components.filter((c) => c.cantidad > 0)
  if (validos.length === 0) return 0

  return validos.reduce(
    (disponible, c) => Math.min(disponible, Math.max(0, Math.floor(c.stockDisponible / c.cantidad))),
    Number.POSITIVE_INFINITY,
  )
}
