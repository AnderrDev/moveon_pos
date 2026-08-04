/**
 * Servicio de dominio puro (TS, sin Angular/Supabase/DOM).
 *
 * Cálculos de apoyo para armar un combo (ADR 0018). El precio que se persiste
 * es UN solo número (`productos.precio_venta`); estas funciones existen para
 * que el formulario le muestre al dueño cuánto está descontando frente a
 * comprar los productos por separado, y para sugerirle el costo.
 *
 * Nada de esto viaja al servidor: `create_sale_atomic` cobra `precio_venta` tal
 * cual. Son ayudas de captura, no reglas de cobro.
 */

/** Precio y costo de un producto incluido, ya resueltos desde el catálogo. */
export interface ComboItemPricing {
  cantidad: number
  precioVenta: number
  costo: number | null
}

export interface ComboSavings {
  /** Suma de los precios de lista de los productos incluidos. */
  sumaNormal: number
  /** Cuánto se ahorra el cliente frente a comprarlos sueltos. */
  ahorro: number
  /** El ahorro como porcentaje de `sumaNormal`, redondeado a un decimal. */
  porcentaje: number
}

/** Suma de `precioVenta × cantidad` de los productos incluidos. */
export function sumComboItemPrice(items: ComboItemPricing[]): number {
  return items.reduce((total, item) => total + item.precioVenta * item.cantidad, 0)
}

/**
 * Costo sugerido del combo: suma de los costos de los productos incluidos. Los
 * productos sin costo registrado suman 0 — el dueño verá un costo menor al real
 * en vez de un `null` que rompa el margen.
 */
export function sumComboItemCost(items: ComboItemPricing[]): number {
  return items.reduce((total, item) => total + (item.costo ?? 0) * item.cantidad, 0)
}

/**
 * Compara el precio del combo contra la suma de sus partes.
 *
 * Un combo más caro que la suma (o una lista vacía) devuelve ahorro y
 * porcentaje en 0 en vez de un número negativo: la UI muestra "sin ahorro", no
 * un descuento al revés.
 */
export function comboSavings(precioCombo: number, items: ComboItemPricing[]): ComboSavings {
  const sumaNormal = sumComboItemPrice(items)
  const ahorro = Math.max(0, sumaNormal - precioCombo)
  const porcentaje = sumaNormal > 0 ? Math.round((ahorro / sumaNormal) * 1000) / 10 : 0

  return { sumaNormal, ahorro, porcentaje }
}
