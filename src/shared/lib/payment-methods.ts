import type { PaymentMethod } from '@/shared/types'

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash:     'Efectivo',
  card:     'Tarjeta',
  transfer: 'Transferencia',
  other:    'Otro',
}

/**
 * Métodos de pago que el negocio acepta hoy: solo efectivo y transferencia.
 * `card` y `other` siguen existiendo en el tipo/BD por compatibilidad con
 * datos históricos (ver `PAYMENT_METHOD_LABELS`), pero ya no se ofrecen como
 * opción en ningún selector (modal de pago, corrección, cierre de caja,
 * filtros de ventas).
 */
export const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash',     label: PAYMENT_METHOD_LABELS.cash },
  { value: 'transfer', label: PAYMENT_METHOD_LABELS.transfer },
]

export const PAYMENT_METHOD_CLOSURE_OPTIONS: { value: PaymentMethod; label: string }[] =
  PAYMENT_METHOD_OPTIONS

export function getPaymentMethodLabel(metodo: string): string {
  return PAYMENT_METHOD_LABELS[metodo as PaymentMethod] ?? metodo
}
