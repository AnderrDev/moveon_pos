import type { PaymentMethod } from '@/shared/types'

export interface PaymentEntryInput {
  metodo: PaymentMethod
  amount: number
  referencia?: string
}

export interface BuiltPaymentEntry {
  metodo: PaymentMethod
  amount: number
  referencia?: string
}

/**
 * `true` cuando el método de pago admite/justifica una referencia externa
 * (voucher, comprobante, transacción). El efectivo nunca lleva referencia.
 */
export function requiresReference(metodo: PaymentMethod): boolean {
  return metodo !== 'cash'
}

/**
 * Arma una entrada de pago lista para el carrito a partir de los datos del
 * modal de cobro. Reglas:
 * - `amount` debe ser entero positivo (> 0); de lo contrario retorna `null`
 *   (contrato: el componente no agrega el pago).
 * - La `referencia` se recorta (trim); vacía o solo espacios → `undefined`.
 * - Si el método es efectivo (`cash`) la referencia se descarta siempre.
 */
export function buildPaymentEntry(input: PaymentEntryInput): BuiltPaymentEntry | null {
  const { metodo, amount } = input

  if (!Number.isInteger(amount) || amount <= 0) return null

  if (!requiresReference(metodo)) {
    return { metodo, amount }
  }

  const referencia = input.referencia?.trim() ?? ''
  if (referencia === '') {
    return { metodo, amount }
  }

  return { metodo, amount, referencia }
}
