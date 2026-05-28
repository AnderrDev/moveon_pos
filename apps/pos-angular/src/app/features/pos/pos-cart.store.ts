import { computed, Injectable, signal } from '@angular/core'
import {
  calculateCartItem,
  calculateCartTotals,
  type CartItemCalculated,
  type CartItemInput,
} from '@/modules/sales/domain/services/sale-calculator'
import type { CartTotals } from '@/modules/sales/domain/services/sale-calculator'
import type { PosProduct, PaymentEntry } from './pos.types'

export interface PosCartItem extends CartItemCalculated {
  key: string
}

function toCartItem(input: CartItemInput): PosCartItem {
  return { ...calculateCartItem(input), key: input.productId }
}

function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `idem-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

@Injectable()
export class PosCartStore {
  private readonly itemsState = signal<PosCartItem[]>([])
  private readonly paymentsState = signal<PaymentEntry[]>([])
  private readonly idempotencyKeyState = signal<string>(generateIdempotencyKey())
  private readonly clienteIdState = signal<string | null>(null)
  private readonly clienteNombreState = signal<string | null>(null)
  private readonly globalDiscountState = signal<number>(0)

  readonly items = this.itemsState.asReadonly()
  readonly payments = this.paymentsState.asReadonly()
  readonly idempotencyKey = this.idempotencyKeyState.asReadonly()
  readonly clienteId = this.clienteIdState.asReadonly()
  readonly clienteNombre = this.clienteNombreState.asReadonly()
  readonly globalDiscount = this.globalDiscountState.asReadonly()
  readonly totals = computed<CartTotals>(() =>
    calculateCartTotals(this.itemsState(), this.globalDiscountState()),
  )
  readonly totalPaid = computed(() =>
    this.paymentsState().reduce((sum, payment) => sum + payment.amount, 0),
  )
  readonly remainingAmount = computed(() => Math.max(0, this.totals().total - this.totalPaid()))
  readonly change = computed(() => Math.max(0, this.totalPaid() - this.totals().total))

  addItem(product: PosProduct): void {
    this.itemsState.update((items) => {
      const existing = items.find((item) => item.key === product.id)
      if (existing) {
        return items.map((item) =>
          item.key === product.id ? toCartItem({ ...item, quantity: item.quantity + 1 }) : item,
        )
      }

      return [
        ...items,
        toCartItem({
          productId: product.id,
          nombre: product.nombre,
          sku: product.sku,
          unitPrice: product.precioVenta,
          ivaTasa: product.ivaTasa,
          quantity: 1,
          discountAmount: 0,
        }),
      ]
    })
  }

  removeItem(productId: string): void {
    this.itemsState.update((items) => items.filter((item) => item.key !== productId))
  }

  updateQuantity(productId: string, quantity: number): void {
    if (quantity <= 0) {
      this.removeItem(productId)
      return
    }

    this.itemsState.update((items) =>
      items.map((item) => (item.key === productId ? toCartItem({ ...item, quantity }) : item)),
    )
  }

  updateDiscount(productId: string, discountAmount: number): void {
    this.itemsState.update((items) =>
      items.map((item) => (item.key === productId ? toCartItem({ ...item, discountAmount }) : item)),
    )
  }

  setCliente(clienteId: string, clienteNombre: string): void {
    this.clienteIdState.set(clienteId)
    this.clienteNombreState.set(clienteNombre)
  }

  clearCliente(): void {
    this.clienteIdState.set(null)
    this.clienteNombreState.set(null)
  }

  /** Descuento comercial global en monto COP sobre el total. Se acota a >= 0. */
  setGlobalDiscount(amount: number): void {
    this.globalDiscountState.set(Math.max(0, Math.round(amount)))
  }

  clearCart(): void {
    this.itemsState.set([])
    this.paymentsState.set([])
    this.idempotencyKeyState.set(generateIdempotencyKey())
    this.clienteIdState.set(null)
    this.clienteNombreState.set(null)
    this.globalDiscountState.set(0)
  }

  addPayment(payment: PaymentEntry): void {
    this.paymentsState.update((payments) => [...payments, payment])
  }

  removePayment(index: number): void {
    this.paymentsState.update((payments) => payments.filter((_payment, i) => i !== index))
  }

  clearPayments(): void {
    this.paymentsState.set([])
  }
}
