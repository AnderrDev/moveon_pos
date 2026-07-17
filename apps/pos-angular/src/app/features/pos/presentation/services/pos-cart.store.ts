import { computed, Injectable, signal } from '@angular/core'
import {
  calculateCartItem,
  calculateCartTotals,
  type CartItemCalculated,
  type CartItemInput,
} from '@angular-app/features/sales/domain/services/sale-calculator'
import type { CartTotals } from '@angular-app/features/sales/domain/services/sale-calculator'
import {
  applyLoyaltyDiscountToItem,
  rewardDiscountForPrice,
} from '@angular-app/features/loyalty/domain/services/stamps'
import { capQuantity } from '@angular-app/features/pos/presentation/services/stock-cap'
import type { PosProduct, PosProductComponent, PaymentEntry } from '@angular-app/features/pos/presentation/services/pos.types'

export interface PosCartItem extends CartItemCalculated {
  key: string
  /** Stock disponible. `null` = el producto no rastrea stock (ej. `prepared`). */
  maxQuantity: number | null
  /** MOVE ON Club: la línea puede generar sellos o canjear una recompensa. */
  participaFidelizacion: boolean
  components: PosProductComponent[]
}

/** Canje MOVE ON Club aplicado al carrito (una recompensa por venta en la UI). */
export interface LoyaltyRedemptionEntry {
  rewardId: string
  productId: string
  /** Descuento efectivo: min(precio unitario, valor de la recompensa). */
  amount: number
}

/**
 * Feedback que la página observa para disparar el toast de tope de stock.
 * El store NO inyecta ToastService: solo expone qué pasó.
 */
export interface StockCapFeedback {
  nombre: string
  maxQuantity: number
}

interface ToCartItemInput extends CartItemInput {
  maxQuantity: number | null
  participaFidelizacion: boolean
  components: PosProductComponent[]
}

function toCartItem(input: ToCartItemInput): PosCartItem {
  return {
    ...calculateCartItem(input),
    key: input.productId,
    maxQuantity: input.maxQuantity,
    participaFidelizacion: input.participaFidelizacion,
    components: input.components,
  }
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
  private readonly stockCapFeedbackState = signal<StockCapFeedback | null>(null)
  private readonly loyaltyRedemptionState = signal<LoyaltyRedemptionEntry | null>(null)

  /**
   * Último tope de stock aplicado. La página lo observa para mostrar el toast y
   * luego lo limpia con `clearStockCapFeedback()`. El store no muestra UI.
   */
  readonly stockCapFeedback = this.stockCapFeedbackState.asReadonly()

  readonly items = this.itemsState.asReadonly()
  readonly payments = this.paymentsState.asReadonly()
  readonly idempotencyKey = this.idempotencyKeyState.asReadonly()
  readonly clienteId = this.clienteIdState.asReadonly()
  readonly clienteNombre = this.clienteNombreState.asReadonly()
  readonly globalDiscount = this.globalDiscountState.asReadonly()

  /**
   * Canje vigente: se auto-invalida si la línea salió del carrito, recibió un
   * descuento manual (RN-LF12: excluyentes) o se quitó el cliente.
   */
  readonly loyaltyRedemption = computed<LoyaltyRedemptionEntry | null>(() => {
    const redemption = this.loyaltyRedemptionState()
    if (!redemption) return null
    if (!this.clienteIdState()) return null
    const item = this.itemsState().find((i) => i.key === redemption.productId)
    if (!item || item.discountAmount > 0 || !item.participaFidelizacion) return null
    return redemption
  })

  readonly totals = computed<CartTotals>(() => {
    const redemption = this.loyaltyRedemption()
    const items = redemption
      ? this.itemsState().map((item) =>
          item.key === redemption.productId
            ? applyLoyaltyDiscountToItem(item, redemption.amount)
            : item,
        )
      : this.itemsState()
    return calculateCartTotals(items, this.globalDiscountState())
  })
  readonly totalPaid = computed(() =>
    this.paymentsState().reduce((sum, payment) => sum + payment.amount, 0),
  )
  readonly remainingAmount = computed(() => Math.max(0, this.totals().total - this.totalPaid()))
  readonly change = computed(() => Math.max(0, this.totalPaid() - this.totals().total))

  addItem(product: PosProduct): void {
    this.itemsState.update((items) => {
      const existing = items.find((item) => item.key === product.id)
      if (existing) {
        const { quantity, capped } = capQuantity(existing.quantity + 1, product.stockDisponible)
        if (capped) this.flagStockCap(product.nombre, product.stockDisponible)
        // Si el tope deja la misma cantidad (ya estaba al máximo) no recreamos el ítem.
        if (quantity === existing.quantity) return items
        return items.map((item) =>
          item.key === product.id
            ? toCartItem({
                ...item,
                quantity,
                maxQuantity: product.stockDisponible,
                participaFidelizacion: item.participaFidelizacion,
                components: item.components,
              })
            : item,
        )
      }

      const { quantity, capped } = capQuantity(1, product.stockDisponible)
      if (capped) this.flagStockCap(product.nombre, product.stockDisponible)
      // max=0 => no se puede agregar la unidad: no se inserta el ítem.
      if (quantity <= 0) return items

      return [
        ...items,
        toCartItem({
          productId: product.id,
          nombre: product.nombre,
          sku: product.sku,
          unitPrice: product.precioVenta,
          ivaTasa: product.ivaTasa,
          quantity,
          discountAmount: 0,
          maxQuantity: product.stockDisponible,
          participaFidelizacion: product.participaFidelizacion,
          components: product.components,
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
      items.map((item) => {
        if (item.key !== productId) return item
        const capped = capQuantity(quantity, item.maxQuantity)
        if (capped.capped) this.flagStockCap(item.nombre, item.maxQuantity)
        return toCartItem({ ...item, quantity: capped.quantity, maxQuantity: item.maxQuantity })
      }),
    )
  }

  updateDiscount(productId: string, discountAmount: number): void {
    this.itemsState.update((items) =>
      items.map((item) => {
        if (item.key !== productId) return item
        // El descuento no cambia la cantidad; el tope se mantiene por seguridad.
        const capped = capQuantity(item.quantity, item.maxQuantity)
        return toCartItem({
          ...item,
          quantity: capped.quantity,
          discountAmount,
          maxQuantity: item.maxQuantity,
        })
      }),
    )
  }

  /** Limpia el feedback de tope tras consumirlo en la página. */
  clearStockCapFeedback(): void {
    this.stockCapFeedbackState.set(null)
  }

  private flagStockCap(nombre: string, maxQuantity: number | null): void {
    // `null` (prepared) nunca topa; defensivo por si llega.
    if (maxQuantity === null) return
    this.stockCapFeedbackState.set({ nombre, maxQuantity })
  }

  setCliente(clienteId: string, clienteNombre: string): void {
    if (this.clienteIdState() !== clienteId) {
      // Cambiar de cliente invalida el canje: la recompensa es de otro cliente.
      this.loyaltyRedemptionState.set(null)
    }
    this.clienteIdState.set(clienteId)
    this.clienteNombreState.set(clienteNombre)
  }

  clearCliente(): void {
    this.clienteIdState.set(null)
    this.clienteNombreState.set(null)
    this.loyaltyRedemptionState.set(null)
  }

  /**
   * Aplica una recompensa MOVE ON Club a una línea del carrito. El descuento
   * efectivo lo define el dominio: min(precio unitario, valor recompensa).
   * El RPC revalida todo (vigencia, estado, elegibilidad) al confirmar.
   */
  applyLoyaltyReward(rewardId: string, rewardValueCop: number, item: PosCartItem): void {
    if (!item.participaFidelizacion || item.discountAmount > 0) return
    this.loyaltyRedemptionState.set({
      rewardId,
      productId: item.key,
      amount: rewardDiscountForPrice(item.unitPrice, rewardValueCop),
    })
  }

  clearLoyaltyRedemption(): void {
    this.loyaltyRedemptionState.set(null)
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
    this.stockCapFeedbackState.set(null)
    this.loyaltyRedemptionState.set(null)
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
