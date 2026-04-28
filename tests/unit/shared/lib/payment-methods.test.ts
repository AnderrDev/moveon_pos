import { describe, expect, it } from 'vitest'
import { getPaymentMethodLabel, PAYMENT_METHOD_CLOSURE_OPTIONS, PAYMENT_METHOD_OPTIONS } from '@/shared/lib/payment-methods'

describe('payment methods', () => {
  it('devuelve labels conocidos', () => {
    expect(getPaymentMethodLabel('cash')).toBe('Efectivo')
    expect(getPaymentMethodLabel('transfer')).toBe('Transferencia')
  })

  it('mantiene métodos desconocidos como fallback', () => {
    expect(getPaymentMethodLabel('wallet')).toBe('wallet')
  })

  it('expone opciones visibles para el modal de pago', () => {
    expect(PAYMENT_METHOD_OPTIONS.map((o) => o.value)).toEqual([
      'cash',
      'card',
      'nequi',
      'daviplata',
      'transfer',
    ])
  })

  it('incluye otros medios en cierre de caja', () => {
    expect(PAYMENT_METHOD_CLOSURE_OPTIONS.map((o) => o.value)).toEqual([
      'cash',
      'card',
      'nequi',
      'daviplata',
      'transfer',
      'other',
    ])
  })
})
