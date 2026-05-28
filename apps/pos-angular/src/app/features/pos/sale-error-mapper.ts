// Pure mapper: traduce el mensaje crudo del RPC `create_sale_atomic` a un mensaje
// legible en español. Vive en la feature `pos` y NO importa Angular/Supabase, así
// se testea sin TestBed (mismo patrón que stock-cap.ts / role-policy.ts).
//
// TODO(RPC): el RPC (supabase/migrations/20260427_002_harden_sales_cash_logic.sql:96)
// hace `raise exception 'Stock insuficiente'` sin datos (producto / disponible /
// solicitado). Debería migrar a `RAISE ... USING ERRCODE/DETAIL` para que el cliente
// reciba el detalle directamente en vez de reconstruirlo desde el carrito. Mientras
// tanto, este mapper reconstruye el detalle comparando `quantity` vs `maxQuantity`.

/** Ítem mínimo del carrito que el mapper necesita para reconstruir el detalle de stock. */
export interface SaleErrorCartItem {
  nombre: string
  quantity: number
  /** Stock disponible conocido por el cliente. `null` = producto sin rastreo (prepared). */
  maxQuantity: number | null
}

const GENERIC_MESSAGE = 'Error al crear venta'

const INSUFFICIENT_STOCK_RAW = 'Stock insuficiente'

// Cadenas que el RPC ya emite en español legible: se pasan tal cual.
const PASSTHROUGH_MESSAGES = [
  'No hay caja abierta para esta venta',
  'La suma de pagos no cubre el total de la venta',
  'El cambio solo puede generarse desde pagos en efectivo',
  'Producto no disponible',
] as const

/**
 * Traduce el mensaje crudo del RPC a un mensaje para el usuario.
 *
 * @param rawMessage mensaje tal cual lo devuelve Supabase/el RPC.
 * @param items ítems del carrito al momento del rechazo (para reconstruir stock).
 */
export function mapSaleError(rawMessage: string, items: readonly SaleErrorCartItem[]): string {
  const message = rawMessage.trim()

  if (message.includes(INSUFFICIENT_STOCK_RAW)) {
    return buildStockMessage(items)
  }

  const passthrough = PASSTHROUGH_MESSAGES.find((candidate) => message.includes(candidate))
  if (passthrough) return passthrough

  return GENERIC_MESSAGE
}

function buildStockMessage(items: readonly SaleErrorCartItem[]): string {
  // Solo ítems con rastreo (maxQuantity !== null) que superan su disponible.
  const offenders = items.filter(
    (item) => item.maxQuantity !== null && item.quantity > item.maxQuantity,
  )

  // Si no hay un único producto identificable, fallback de stock.
  if (offenders.length !== 1) {
    return 'Stock insuficiente para completar la venta'
  }

  const offender = offenders[0]
  return `Stock insuficiente de "${offender.nombre}": disponible ${offender.maxQuantity}, solicitado ${offender.quantity}`
}
