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

  it('expone solo efectivo y transferencia en el modal de pago', () => {
    expect(PAYMENT_METHOD_OPTIONS.map((o) => o.value)).toEqual(['cash', 'transfer'])
  })

  it('cierre de caja usa las mismas opciones (sin tarjeta ni otro)', () => {
    expect(PAYMENT_METHOD_CLOSURE_OPTIONS.map((o) => o.value)).toEqual(['cash', 'transfer'])
  })

  it('mantiene el label de tarjeta/otro para mostrar datos históricos', () => {
    expect(getPaymentMethodLabel('card')).toBe('Tarjeta')
    expect(getPaymentMethodLabel('other')).toBe('Otro')
  })
})
