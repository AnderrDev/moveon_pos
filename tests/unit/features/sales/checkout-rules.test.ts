import { describe, expect, it } from 'vitest'
import { canConfirmSale, discretionaryDiscount, type CheckoutState } from '@angular-app/features/sales/domain/services/checkout-rules'

const ready: CheckoutState = {
  itemsCount: 2,
  total: 100000,
  totalPaid: 100000,
  discretionaryDiscount: 0,
  discountReason: '',
  discountAuthorizationError: null,
  paymentError: null,
}

describe('discretionaryDiscount', () => {
  it('excluye el canje del club del descuento que exige motivo', () => {
    expect(discretionaryDiscount(15000, 11000)).toBe(4000)
    expect(discretionaryDiscount(11000, 11000)).toBe(0)
  })
})

describe('canConfirmSale', () => {
  it('permite confirmar una venta pagada sin descuento', () => {
    expect(canConfirmSale(ready)).toBe(true)
  })

  it('bloquea sin productos o con pago incompleto', () => {
    expect(canConfirmSale({ ...ready, itemsCount: 0 })).toBe(false)
    expect(canConfirmSale({ ...ready, totalPaid: 99999 })).toBe(false)
  })

  it('exige motivo de al menos 3 caracteres solo con descuento discrecional', () => {
    expect(canConfirmSale({ ...ready, discretionaryDiscount: 5000, discountReason: '  ab ' })).toBe(false)
    expect(canConfirmSale({ ...ready, discretionaryDiscount: 5000, discountReason: 'Cliente frecuente' })).toBe(true)
  })

  it('bloquea con descuento no autorizado o pagos inválidos', () => {
    expect(canConfirmSale({ ...ready, discountAuthorizationError: 'Requiere admin' })).toBe(false)
    expect(canConfirmSale({ ...ready, paymentError: 'Cambio solo en efectivo' })).toBe(false)
  })
})
