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

// Copy accionable de caja: el RPC emite 'No hay caja abierta para esta venta',
// pero el usuario necesita saber qué hacer. Texto canónico único.
const NO_OPEN_CASH_SESSION_MESSAGE = 'No hay una caja abierta. Abre la caja antes de vender.'

/**
 * Cadenas conocidas del RPC → texto canónico en español para el usuario.
 * `raw` es lo que emite el RPC; `display` es el texto que ve el operador.
 */
const KNOWN_MESSAGES: readonly { raw: string; display: string }[] = [
  { raw: 'No hay caja abierta para esta venta', display: NO_OPEN_CASH_SESSION_MESSAGE },
  {
    raw: 'La suma de pagos no cubre el total de la venta',
    display: 'La suma de pagos no cubre el total de la venta',
  },
  {
    raw: 'El cambio solo puede generarse desde pagos en efectivo',
    display: 'El cambio solo puede generarse desde pagos en efectivo',
  },
  { raw: 'Producto no disponible', display: 'Producto no disponible' },
]

/**
 * Traduce el mensaje crudo del RPC a un mensaje para el usuario.
 *
 * El matching es case-insensitive y tolera prefijos del driver (ej. 'error: ...'),
 * ya que postgrest-js puede anteponer texto al mensaje del RPC. Siempre devuelve el
 * texto canónico en español, nunca el crudo.
 *
 * @param rawMessage mensaje tal cual lo devuelve Supabase/el RPC.
 * @param items ítems del carrito al momento del rechazo (para reconstruir stock).
 */
export function mapSaleError(rawMessage: string, items: readonly SaleErrorCartItem[]): string {
  const message = rawMessage.trim().toLowerCase()

  // Stock primero: puede reconstruir un detalle más específico desde el carrito.
  if (message.includes(INSUFFICIENT_STOCK_RAW.toLowerCase())) {
    return buildStockMessage(items)
  }

  const known = KNOWN_MESSAGES.find((candidate) =>
    message.includes(candidate.raw.toLowerCase()),
  )
  if (known) return known.display

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
