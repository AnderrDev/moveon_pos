import type { PaymentMethod } from '@/shared/types'

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash:     'Efectivo',
  card:     'Tarjeta',
  transfer: 'Transferencia',
  other:    'Otro',
}

/**
 * Efectivo y transferencia: los métodos de la corrección de pagos, el cierre
 * de caja y los filtros de ventas. `other` sigue en el tipo/BD solo por datos
 * históricos. La tarjeta se ofrece únicamente en el cobro
 * (`CHECKOUT_PAYMENT_METHOD_OPTIONS`).
 */
export const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash',     label: PAYMENT_METHOD_LABELS.cash },
  { value: 'transfer', label: PAYMENT_METHOD_LABELS.transfer },
]

/**
 * Métodos del modal de cobro: los de arriba + tarjeta vía Nequi Negocios, que
 * suma el recargo de la comisión (ADR 0024). La corrección de pagos y el
 * cierre de caja siguen sin tarjeta hasta PLAN-101.
 */
export const CHECKOUT_PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  ...PAYMENT_METHOD_OPTIONS,
  { value: 'card', label: PAYMENT_METHOD_LABELS.card },
]

export const PAYMENT_METHOD_CLOSURE_OPTIONS: { value: PaymentMethod; label: string }[] =
  PAYMENT_METHOD_OPTIONS

export function getPaymentMethodLabel(metodo: string): string {
  return PAYMENT_METHOD_LABELS[metodo as PaymentMethod] ?? metodo
}

/** Opciones del filtro por método de pago en listados de ventas ('' = todos). */
export const PAYMENT_FILTER_OPTIONS: { value: PaymentMethod | ''; label: string }[] = [
  { value: '', label: 'Todos los métodos' },
  ...PAYMENT_METHOD_CLOSURE_OPTIONS,
]
