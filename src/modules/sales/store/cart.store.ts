import { create } from 'zustand'
import { calculateCartItem, calculateCartTotals } from '../domain/services/sale-calculator'
import type { CartItemInput, CartItemCalculated, CartTotals } from '../domain/services/sale-calculator'
import type { IvaRate, PaymentMethod } from '@/shared/types'

export interface CartProduct {
  id: string
  nombre: string
  sku: string | null
  precioVenta: number
  ivaTasa: IvaRate
}

export interface CartItem extends CartItemCalculated {
  key: string  // productId
}

export interface PaymentEntry {
  metodo: PaymentMethod
  amount: number
  referencia?: string
}

interface CartState {
  items:    CartItem[]
  payments: PaymentEntry[]
  totals:   CartTotals

  addItem:           (product: CartProduct) => void
  removeItem:        (productId: string) => void
  updateQuantity:    (productId: string, quantity: number) => void
  updateDiscount:    (productId: string, discountAmount: number) => void
  clearCart:         () => void
  addPayment:        (payment: PaymentEntry) => void
  removePayment:     (index: number) => void
  clearPayments:     () => void
  totalPaid:         () => number
  remainingAmount:   () => number
}

function toCartItem(input: CartItemInput): CartItem {
  return { ...calculateCartItem(input), key: input.productId }
}

function recalcTotals(items: CartItem[]): CartTotals {
  return calculateCartTotals(items)
}

export const useCartStore = create<CartState>((set, get) => ({
  items:    [],
  payments: [],
  totals:   { subtotal: 0, discountTotal: 0, taxTotal: 0, total: 0 },

  addItem: (product) => {
    set((state) => {
      const existing = state.items.find((i) => i.key === product.id)
      let newItems: CartItem[]
      if (existing) {
        newItems = state.items.map((i) =>
          i.key === product.id
            ? toCartItem({ ...i, quantity: i.quantity + 1 })
            : i,
        )
      } else {
        const newItem: CartItemInput = {
          productId:      product.id,
          nombre:         product.nombre,
          sku:            product.sku,
          unitPrice:      product.precioVenta,
          ivaTasa:        product.ivaTasa,
          quantity:       1,
          discountAmount: 0,
        }
        newItems = [...state.items, toCartItem(newItem)]
      }
      return { items: newItems, totals: recalcTotals(newItems) }
    })
  },

  removeItem: (productId) => {
    set((state) => {
      const newItems = state.items.filter((i) => i.key !== productId)
      return { items: newItems, totals: recalcTotals(newItems) }
    })
  },

  updateQuantity: (productId, quantity) => {
    if (quantity <= 0) {
      get().removeItem(productId)
      return
    }
    set((state) => {
      const newItems = state.items.map((i) =>
        i.key === productId ? toCartItem({ ...i, quantity }) : i,
      )
      return { items: newItems, totals: recalcTotals(newItems) }
    })
  },

  updateDiscount: (productId, discountAmount) => {
    set((state) => {
      const newItems = state.items.map((i) =>
        i.key === productId ? toCartItem({ ...i, discountAmount }) : i,
      )
      return { items: newItems, totals: recalcTotals(newItems) }
    })
  },

  clearCart: () => {
    set({ items: [], payments: [], totals: { subtotal: 0, discountTotal: 0, taxTotal: 0, total: 0 } })
  },

  addPayment: (payment) => {
    set((state) => ({ payments: [...state.payments, payment] }))
  },

  removePayment: (index) => {
    set((state) => ({ payments: state.payments.filter((_, i) => i !== index) }))
  },

  clearPayments: () => set({ payments: [] }),

  totalPaid: () => get().payments.reduce((s, p) => s + p.amount, 0),

  remainingAmount: () => {
    const total = get().totals.total
    const paid  = get().totalPaid()
    return Math.max(0, total - paid)
  },
}))
