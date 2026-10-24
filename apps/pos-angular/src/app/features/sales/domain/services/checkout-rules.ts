/**
 * Reglas del cobro en el POS (TS puro). Antes vivían como `computed` dentro de
 * `pos.page.ts`. El RPC `create_sale_atomic` sigue siendo la autoridad; esto
 * decide qué puede confirmar el cajero antes de enviar.
 */

/** Mínimo de caracteres del motivo cuando hay descuento discrecional. */
export const DISCOUNT_REASON_MIN_LENGTH = 3

/**
 * Descuento discrecional = descuento total − canje MOVE ON Club. El canje no
 * exige motivo (RN-LF12 / ADR 0013 §5); el resto sí.
 */
export function discretionaryDiscount(discountTotal: number, redemptionAmount: number): number {
  return discountTotal - redemptionAmount
}

export interface CheckoutState {
  itemsCount: number
  total: number
  totalPaid: number
  discretionaryDiscount: number
  discountReason: string
  /** `validateDiscountAuthorization` (null = autorizado). */
  discountAuthorizationError: string | null
  /** `validatePaymentsForSale` (null = pagos válidos). */
  paymentError: string | null
}

/** `true` cuando la venta se puede confirmar. */
export function canConfirmSale(state: CheckoutState): boolean {
  const needsReason = state.discretionaryDiscount > 0
  return (
    state.itemsCount > 0 &&
    state.totalPaid >= state.total &&
    (!needsReason || state.discountReason.trim().length >= DISCOUNT_REASON_MIN_LENGTH) &&
    state.discountAuthorizationError === null &&
    state.paymentError === null
  )
}
