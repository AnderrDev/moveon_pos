import '@angular/compiler'
import { Injector, runInInjectionContext, signal } from '@angular/core'
import { describe, expect, it } from 'vitest'
import { SessionService } from '@angular-app/core/auth/session.service'
import { PosCartStore } from '@angular-app/features/pos/presentation/services/pos-cart.store'
import { PosCheckoutStore } from '@angular-app/features/pos/presentation/services/pos-checkout.store'
import type { PosProduct } from '@angular-app/features/pos/presentation/services/pos.types'

// PosCheckoutStore con un PosCartStore real (sin dependencias) y la sesión falsa.

const whey = {
  id: 'whey', nombre: 'Whey', sku: null, codigoBarras: null, precioVenta: 120000, costo: null,
  ivaTasa: 0, categoriaId: null, paraQueSirve: null, recomendadoPara: null, tipo: 'simple',
  participaFidelizacion: true, stockDisponible: 10, components: [], options: [],
} as PosProduct

const input = (value: string) => ({ target: { value } }) as unknown as Event

function setup(role: 'admin' | 'cajero' = 'cajero') {
  const injector = Injector.create({
    providers: [
      PosCartStore,
      PosCheckoutStore,
      { provide: SessionService, useValue: { role: signal(role) } },
    ],
  })
  return runInInjectionContext(injector, () => ({
    cart: injector.get(PosCartStore),
    checkout: injector.get(PosCheckoutStore),
  }))
}

describe('PosCheckoutStore', () => {
  it('abre con el faltante prellenado y el default de tirilla de la tienda', () => {
    const { cart, checkout } = setup()
    cart.addItem(whey)
    checkout.open(true)
    expect(checkout.isOpen()).toBe(true)
    expect(checkout.paymentAmount()).toBe('120000')
    expect(checkout.imprimirEstaVenta()).toBe(true)
  })

  it('convierte el descuento entre pesos y porcentaje sin cambiar el monto', () => {
    const { cart, checkout } = setup()
    cart.addItem(whey)
    checkout.setGlobalDiscount(input('12.000'))
    expect(cart.globalDiscount()).toBe(12000)
    checkout.setDiscountMode('percent')
    expect(checkout.globalDiscountPercentInput()).toBe('10')
    checkout.setGlobalDiscountPercent(input('150'))
    expect(checkout.globalDiscountPercentInput()).toBe('100')
    checkout.setGlobalDiscountPercent(input('25'))
    expect(cart.globalDiscount()).toBe(30000)
  })

  it('exige motivo con descuento discrecional antes de confirmar', () => {
    const { cart, checkout } = setup('admin')
    cart.addItem(whey)
    checkout.setGlobalDiscount(input('10000'))
    checkout.open(false)
    checkout.addExactPayment()
    expect(cart.remainingAmount()).toBe(0)
    expect(checkout.canConfirm()).toBe(false)
    checkout.setDiscountReason(input('Cliente frecuente'))
    expect(checkout.canConfirm()).toBe(true)
  })

  it('registra pagos parciales, limpia la referencia y reprellena el faltante', () => {
    const { cart, checkout } = setup()
    cart.addItem(whey)
    checkout.open(false)
    checkout.selectPaymentMethod('transfer')
    expect(checkout.showReference()).toBe(true)
    checkout.setPaymentAmount(input('100000'))
    checkout.setPaymentReference(input('NEQUI-1'))
    checkout.addPayment()
    expect(cart.payments()).toEqual([expect.objectContaining({ metodo: 'transfer', amount: 100000, referencia: 'NEQUI-1' })])
    expect(checkout.paymentReference()).toBe('')
    expect(checkout.paymentAmount()).toBe('20000')
    checkout.selectPaymentMethod('cash')
    expect(checkout.showReference()).toBe(false)
  })

  it('tarjeta: muestra el recargo, lo guarda aparte y suma el total a cobrar (ADR 0024)', () => {
    const { cart, checkout } = setup()
    cart.addItem(whey)
    checkout.open(false)
    checkout.selectPaymentMethod('card')
    expect(checkout.pendingCardCharge()).toEqual({ baseAmount: 120000, chargeAmount: 122911, surcharge: 2911 })
    checkout.addPayment()
    expect(cart.payments()).toEqual([expect.objectContaining({ metodo: 'card', amount: 120000, cardSurcharge: 2911 })])
    expect(cart.remainingAmount()).toBe(0)
    expect(cart.totalToCharge()).toBe(122911)
    expect(checkout.canConfirm()).toBe(true)
  })

  it('tarjeta en pago mixto: el recargo va solo sobre la parte con tarjeta', () => {
    const { cart, checkout } = setup()
    cart.addItem(whey)
    checkout.open(false)
    checkout.setPaymentAmount(input('100000'))
    checkout.addPayment()
    checkout.selectPaymentMethod('card')
    checkout.addExactPayment()
    expect(cart.cardSurchargeTotal()).toBe(486)
    expect(cart.totalToCharge()).toBe(120486)
  })

  it('tarjeta: no agrega cobros fuera de los límites de Nequi ni mayores a lo que falta', () => {
    const { cart, checkout } = setup()
    cart.addItem(whey)
    checkout.open(false)
    checkout.selectPaymentMethod('card')
    checkout.setPaymentAmount(input('1000'))
    checkout.addPayment()
    expect(cart.payments()).toEqual([])
    expect(checkout.paymentError()).toMatch(/1\.500/)

    checkout.setPaymentAmount(input('130000'))
    expect(checkout.paymentError()).toBeNull()
    checkout.addPayment()
    expect(cart.payments()).toEqual([])
    expect(checkout.paymentError()).toMatch(/lo que falta/)
  })

  it('tarjeta: usa la tarifa de la tienda que recibe al abrir', () => {
    const { cart, checkout } = setup()
    cart.addItem(whey)
    checkout.open(false, { rateBps: 250, ivaPct: 19, rounding: 'half-up', ivaBase: 'rounded-commission' })
    checkout.selectPaymentMethod('card')
    expect(checkout.pendingCardCharge()?.surcharge).toBe(3679)
  })

  it('cerrar descarta los pagos y reiniciar deja el cobro limpio', () => {
    const { cart, checkout } = setup()
    cart.addItem(whey)
    checkout.open(false)
    checkout.addExactPayment()
    checkout.close()
    expect(checkout.isOpen()).toBe(false)
    expect(cart.payments()).toEqual([])

    checkout.setDiscountMode('percent')
    checkout.setDiscountReason(input('x'))
    checkout.selectPaymentMethod('transfer')
    checkout.resetAfterSale()
    expect([checkout.discountMode(), checkout.discountReason(), checkout.paymentMethod()]).toEqual(['amount', '', 'cash'])
  })

  it('no cierra mientras guarda la venta', () => {
    const { cart, checkout } = setup()
    cart.addItem(whey)
    checkout.open(false)
    checkout.isSaving.set(true)
    checkout.close()
    expect(checkout.isOpen()).toBe(true)
  })
})
