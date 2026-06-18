import type { PaymentMethod } from '@/shared/types'

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash:     'Efectivo',
  card:     'Tarjeta',
  transfer: 'Transferencia',
  other:    'Otro',
}

export const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash',     label: PAYMENT_METHOD_LABELS.cash },
  { value: 'card',     label: PAYMENT_METHOD_LABELS.card },
  { value: 'transfer', label: PAYMENT_METHOD_LABELS.transfer },
]

export const PAYMENT_METHOD_CLOSURE_OPTIONS: { value: PaymentMethod; label: string }[] = [
  ...PAYMENT_METHOD_OPTIONS,
  { value: 'other', label: PAYMENT_METHOD_LABELS.other },
]

export function getPaymentMethodLabel(metodo: string): string {
  return PAYMENT_METHOD_LABELS[metodo as PaymentMethod] ?? metodo
}
