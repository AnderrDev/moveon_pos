// Recuperación de una venta cuyo resultado se perdió (recarga, caída de red,
// pestaña cerrada) mientras se cobraba. El carrito NO sobrevive a una recarga,
// así que reutilizar la idempotency key con otro carrito devolvería la venta
// anterior sin registrar la nueva. En su lugar se guarda la "venta en curso"
// y, al volver al POS, se consulta si esa clave alcanzó a registrarse para
// decirle al cajero si debe volver a cobrarla.
//
// Funciones puras con el Storage inyectado (testeables sin Angular). Todo
// acceso a storage va en try/catch: puede no existir o estar bloqueado.

export interface PendingSale {
  idempotencyKey: string
  tiendaId: string
  total: number
  startedAt: string
}

const STORAGE_KEY = 'mo.pos.pendingSale'

export function savePendingSale(storage: Storage | null, sale: PendingSale): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(sale))
  } catch {
    // Sin storage no hay recuperación; la venta sigue protegida por la clave.
  }
}

export function clearPendingSale(storage: Storage | null): void {
  try {
    storage?.removeItem(STORAGE_KEY)
  } catch {
    // ignorado: ver savePendingSale
  }
}

/** Venta en curso de esta tienda, o `null` si no hay o el contenido no es válido. */
export function readPendingSale(storage: Storage | null, tiendaId: string): PendingSale | null {
  let raw: string | null = null
  try {
    raw = storage?.getItem(STORAGE_KEY) ?? null
  } catch {
    return null
  }
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<PendingSale>
    if (
      typeof parsed.idempotencyKey !== 'string' ||
      !parsed.idempotencyKey ||
      parsed.tiendaId !== tiendaId ||
      typeof parsed.total !== 'number' ||
      typeof parsed.startedAt !== 'string'
    ) {
      return null
    }
    return parsed as PendingSale
  } catch {
    return null
  }
}

export type PendingSaleOutcome =
  | { kind: 'registered'; saleNumber: string; total: number }
  | { kind: 'not_registered'; total: number }

/** Mensaje para el cajero según si la venta en curso alcanzó a registrarse. */
export function pendingSaleMessage(outcome: PendingSaleOutcome, formatMoney: (n: number) => string): string {
  return outcome.kind === 'registered'
    ? `La venta de ${formatMoney(outcome.total)} que se estaba cobrando sí quedó registrada (${outcome.saleNumber}). No la cobres de nuevo.`
    : `La venta de ${formatMoney(outcome.total)} que se estaba cobrando no quedó registrada. Si el cliente aún no ha pagado, vuelve a cobrarla.`
}
