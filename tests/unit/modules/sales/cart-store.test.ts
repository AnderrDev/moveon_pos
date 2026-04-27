import { beforeEach, describe, expect, it } from 'vitest'
import { useCartStore } from '@/modules/sales/store/cart.store'

const initialState = {
  items: [],
  payments: [],
  totals: { subtotal: 0, discountTotal: 0, taxTotal: 0, total: 0 },
}

describe('useCartStore', () => {
  beforeEach(() => {
    useCartStore.setState(initialState)
  })

  it('agrega un producto nuevo al carrito y calcula totales', () => {
    useCartStore.getState().addItem({
      id: 'product-1',
      nombre: 'Whey Protein',
      sku: 'WHY-001',
      precioVenta: 100000,
      ivaTasa: 19,
    })

    const state = useCartStore.getState()
    expect(state.items).toHaveLength(1)
    expect(state.items[0].quantity).toBe(1)
    expect(state.totals.subtotal).toBe(100000)
    expect(state.totals.taxTotal).toBe(19000)
    expect(state.totals.total).toBe(119000)
  })

  it('incrementa cantidad cuando se agrega el mismo producto', () => {
    const product = {
      id: 'product-1',
      nombre: 'Creatina',
      sku: null,
      precioVenta: 50000,
      ivaTasa: 0 as const,
    }

    useCartStore.getState().addItem(product)
    useCartStore.getState().addItem(product)

    const state = useCartStore.getState()
    expect(state.items).toHaveLength(1)
    expect(state.items[0].quantity).toBe(2)
    expect(state.totals.total).toBe(100000)
  })

  it('elimina el item cuando la cantidad llega a cero', () => {
    useCartStore.getState().addItem({
      id: 'product-1',
      nombre: 'Agua',
      sku: null,
      precioVenta: 2000,
      ivaTasa: 0,
    })

    useCartStore.getState().updateQuantity('product-1', 0)

    const state = useCartStore.getState()
    expect(state.items).toHaveLength(0)
    expect(state.totals.total).toBe(0)
  })

  it('recalcula descuentos y pagos pendientes', () => {
    useCartStore.getState().addItem({
      id: 'product-1',
      nombre: 'Snack',
      sku: null,
      precioVenta: 10000,
      ivaTasa: 0,
    })
    useCartStore.getState().updateQuantity('product-1', 3)
    useCartStore.getState().updateDiscount('product-1', 1000)
    useCartStore.getState().addPayment({ metodo: 'cash', amount: 10000 })

    const state = useCartStore.getState()
    expect(state.totals.discountTotal).toBe(3000)
    expect(state.totals.total).toBe(27000)
    expect(state.totalPaid()).toBe(10000)
    expect(state.remainingAmount()).toBe(17000)
  })

  it('clearCart limpia items, pagos y totales', () => {
    useCartStore.getState().addItem({
      id: 'product-1',
      nombre: 'Batido',
      sku: null,
      precioVenta: 12000,
      ivaTasa: 5,
    })
    useCartStore.getState().addPayment({ metodo: 'nequi', amount: 12600 })

    useCartStore.getState().clearCart()

    const state = useCartStore.getState()
    expect(state.items).toHaveLength(0)
    expect(state.payments).toHaveLength(0)
    expect(state.totals.total).toBe(0)
  })
})
