import type { PaymentMethod } from '@/shared/types'

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash:      'Efectivo',
  card:      'Tarjeta',
  nequi:     'Nequi',
  daviplata: 'Daviplata',
  transfer:  'Transferencia',
  other:     'Otro',
}

export const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash',      label: PAYMENT_METHOD_LABELS.cash },
  { value: 'card',      label: PAYMENT_METHOD_LABELS.card },
  { value: 'nequi',     label: PAYMENT_METHOD_LABELS.nequi },
  { value: 'daviplata', label: PAYMENT_METHOD_LABELS.daviplata },
  { value: 'transfer',  label: PAYMENT_METHOD_LABELS.transfer },
]

export function getPaymentMethodLabel(metodo: string): string {
  return PAYMENT_METHOD_LABELS[metodo as PaymentMethod] ?? metodo
}
