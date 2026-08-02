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

/** Opción elegida para la línea (ej. proteína del batido). ADR 0017. */
export interface PosCartOption {
  id: string
  nombre: string
  precioExtra: number
}

export interface PosCartItem extends CartItemCalculated {
  /**
   * Identidad de la línea: `productId`, o `productId:optionId` cuando el
   * producto se vendió con una opción. Dos batidos con proteína distinta son
   * dos líneas; con la misma proteína, se acumulan (ADR 0017 §2.5).
   */
  key: string
  /** Stock disponible. `null` = el producto no rastrea stock (ej. `prepared`). */
  maxQuantity: number | null
  /** MOVE ON Club: la línea puede generar sellos o canjear una recompensa. */
  participaFidelizacion: boolean
  components: PosProductComponent[]
  option: PosCartOption | null
}

/** Canje MOVE ON Club aplicado al carrito (una recompensa por venta en la UI). */
export interface LoyaltyRedemptionEntry {
  rewardId: string
  /** `PosCartItem.key` de la línea canjeada, no el id del producto. */
  itemKey: string
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
  option: PosCartOption | null
}

/** Clave de línea: el producto, más la opción cuando la hay (ADR 0017 §2.5). */
export function cartItemKey(productId: string, optionId: string | null): string {
  return optionId ? `${productId}:${optionId}` : productId
}

function toCartItem(input: ToCartItemInput): PosCartItem {
  return {
    ...calculateCartItem(input),
    key: cartItemKey(input.productId, input.option?.id ?? null),
    maxQuantity: input.maxQuantity,
    participaFidelizacion: input.participaFidelizacion,
    components: input.components,
    option: input.option,
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
    const item = this.itemsState().find((i) => i.key === redemption.itemKey)
    if (!item || item.discountAmount > 0 || !item.participaFidelizacion) return null
    return redemption
  })

  /** Ítems con el canje MOVE ON Club ya aplicado: base de todos los totales. */
  private readonly itemsForTotals = computed<PosCartItem[]>(() => {
    const redemption = this.loyaltyRedemption()
    if (!redemption) return this.itemsState()
    return this.itemsState().map((item) =>
      item.key === redemption.itemKey
        ? applyLoyaltyDiscountToItem(item, redemption.amount)
        : item,
    )
  })

  readonly totals = computed<CartTotals>(() =>
    calculateCartTotals(this.itemsForTotals(), this.globalDiscountState()),
  )

  /**
   * Descuento global recortado al total realmente disponible (tras descuentos
   * de línea y canje). `calculateCartTotals` ya lo recorta para mostrar el
   * total, pero el RPC rechaza un `p_global_discount_total` mayor al total
   * disponible ("El descuento global no puede superar el total disponible").
   * Este es el valor que se envía a `create_sale_atomic`, de modo que un
   * descuento del 100% (o un monto tecleado de más) pase sin error.
   */
  readonly effectiveGlobalDiscount = computed(() => {
    const available = calculateCartTotals(this.itemsForTotals()).total
    return Math.max(0, Math.min(Math.round(this.globalDiscountState()), available))
  })
  readonly totalPaid = computed(() =>
    this.paymentsState().reduce((sum, payment) => sum + payment.amount, 0),
  )
  readonly remainingAmount = computed(() => Math.max(0, this.totals().total - this.totalPaid()))
  readonly change = computed(() => Math.max(0, this.totalPaid() - this.totals().total))

  /**
   * Agrega una unidad del producto. `option` viene del diálogo de selección
   * (ADR 0017); su recargo se suma al precio unitario mostrado, pero el precio
   * que manda es el que recalcula el RPC al confirmar la venta.
   */
  addItem(product: PosProduct, option: PosCartOption | null = null): void {
    const key = cartItemKey(product.id, option?.id ?? null)
    const unitPrice = product.precioVenta + (option?.precioExtra ?? 0)

    this.itemsState.update((items) => {
      const existing = items.find((item) => item.key === key)
      if (existing) {
        const { quantity, capped } = capQuantity(existing.quantity + 1, product.stockDisponible)
        if (capped) this.flagStockCap(product.nombre, product.stockDisponible)
        // Si el tope deja la misma cantidad (ya estaba al máximo) no recreamos el ítem.
        if (quantity === existing.quantity) return items
        return items.map((item) =>
          item.key === key
            ? toCartItem({
                ...item,
                quantity,
                maxQuantity: product.stockDisponible,
                participaFidelizacion: item.participaFidelizacion,
                components: item.components,
                option: item.option,
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
          unitPrice,
          ivaTasa: product.ivaTasa,
          quantity,
          discountAmount: 0,
          maxQuantity: product.stockDisponible,
          participaFidelizacion: product.participaFidelizacion,
          components: product.components,
          option,
        }),
      ]
    })
  }

  removeItem(itemKey: string): void {
    this.itemsState.update((items) => items.filter((item) => item.key !== itemKey))
  }

  updateQuantity(itemKey: string, quantity: number): void {
    if (quantity <= 0) {
      this.removeItem(itemKey)
      return
    }

    this.itemsState.update((items) =>
      items.map((item) => {
        if (item.key !== itemKey) return item
        const capped = capQuantity(quantity, item.maxQuantity)
        if (capped.capped) this.flagStockCap(item.nombre, item.maxQuantity)
        return toCartItem({ ...item, quantity: capped.quantity, maxQuantity: item.maxQuantity })
      }),
    )
  }

  updateDiscount(itemKey: string, discountAmount: number): void {
    this.itemsState.update((items) =>
      items.map((item) => {
        if (item.key !== itemKey) return item
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
      itemKey: item.key,
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
