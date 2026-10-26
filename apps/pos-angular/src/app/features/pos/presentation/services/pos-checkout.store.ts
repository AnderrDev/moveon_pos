import { computed, inject, Injectable, signal } from '@angular/core'
import { SessionService } from '@angular-app/core/auth/session.service'
import type { PaymentMethod } from '@/shared/types'
import { buildPaymentEntry, requiresReference } from '@angular-app/features/sales/domain/services/sale-builder'
import {
  validateDiscountAuthorization,
  validatePaymentsForSale,
} from '@angular-app/features/sales/domain/services/sale-calculator'
import { canConfirmSale, discretionaryDiscount } from '@angular-app/features/sales/domain/services/checkout-rules'
import {
  NEQUI_CARD_FEE,
  calculateCardCharge,
  validateCardChargeAmount,
  type CardCharge,
  type CardFeeConfig,
} from '@angular-app/features/sales/domain/services/card-surcharge'
import { PosCartStore } from '@angular-app/features/pos/presentation/services/pos-cart.store'

/**
 * Estado del cobro del POS: pago en captura, descuento global (en pesos o %),
 * motivo y elección de tirilla. Antes vivía en `pos.page.ts`. Lo provee
 * `PosPage` junto a `PosCartStore` (misma instancia para la página y el
 * diálogo de cobro). Las reglas de negocio están en `checkout-rules.ts`; el
 * flujo de confirmar la venta sigue en la página.
 */
@Injectable()
export class PosCheckoutStore {
  private readonly cart = inject(PosCartStore)
  private readonly session = inject(SessionService)

  readonly isOpen = signal(false)
  readonly paymentMethod = signal<PaymentMethod>('cash')
  readonly paymentAmount = signal('')
  readonly paymentReference = signal('')
  readonly globalDiscountInput = signal('')
  readonly globalDiscountPercentInput = signal('')
  readonly discountMode = signal<'amount' | 'percent'>('amount')
  readonly discountReason = signal('')
  readonly saleError = signal<string | null>(null)
  readonly isSaving = signal(false)
  /** Elección de tirilla para ESTA venta (parte del default de la tienda). */
  readonly imprimirEstaVenta = signal(false)
  /** Tarifa de la tienda para el recargo por tarjeta (ADR 0024). */
  readonly cardFee = signal<CardFeeConfig>(NEQUI_CARD_FEE)
  /** Error al agregar un pago (p. ej. cobro con tarjeta fuera de los límites). */
  readonly paymentError = signal<string | null>(null)

  /**
   * Vista previa del cobro con tarjeta del monto en captura: lo que se suma
   * de recargo y lo que hay que pasar por el datáfono. Null si no es tarjeta.
   */
  readonly pendingCardCharge = computed<CardCharge | null>(() => {
    if (this.paymentMethod() !== 'card') return null
    const amount = Number.parseInt(this.paymentAmount().replace(/\D/g, ''), 10)
    if (!Number.isInteger(amount) || amount <= 0) return null
    return calculateCardCharge(amount, this.cardFee())
  })

  /**
   * Descuento discrecional = total − canje MOVE ON Club. El canje no exige
   * motivo (RN-LF12 / ADR 0013 §5).
   */
  readonly discretionaryDiscountTotal = computed(() =>
    discretionaryDiscount(this.cart.totals().discountTotal, this.cart.loyaltyRedemption()?.amount ?? 0),
  )

  readonly discountAuthorizationError = computed(() => {
    const role = this.session.role()
    if (!role) return null
    return validateDiscountAuthorization(role, this.cart.totals().subtotal, this.discretionaryDiscountTotal())
  })

  readonly canConfirm = computed(() =>
    canConfirmSale({
      itemsCount: this.cart.items().length,
      total: this.cart.totals().total,
      totalPaid: this.cart.totalPaid(),
      discretionaryDiscount: this.discretionaryDiscountTotal(),
      discountReason: this.discountReason(),
      discountAuthorizationError: this.discountAuthorizationError(),
      paymentError: validatePaymentsForSale(this.cart.payments(), this.cart.totals().total),
    }),
  )

  /** El campo "Referencia" solo aplica a métodos no-efectivo. */
  readonly showReference = computed(() => requiresReference(this.paymentMethod()))

  discountPercentage(): string {
    const subtotal = this.cart.totals().subtotal
    if (subtotal <= 0) return '0.00'
    return ((this.discretionaryDiscountTotal() / subtotal) * 100).toFixed(2)
  }

  /** Abre el cobro con el default de tirilla de la tienda y el faltante prellenado. */
  open(printByDefault: boolean, cardFee: CardFeeConfig = NEQUI_CARD_FEE): void {
    this.saleError.set(null)
    this.paymentError.set(null)
    this.cardFee.set(cardFee)
    this.imprimirEstaVenta.set(printByDefault)
    this.isOpen.set(true)
    this.discountMode.set('amount')
    const currentGlobal = this.cart.globalDiscount()
    this.globalDiscountInput.set(currentGlobal > 0 ? String(currentGlobal) : '')
    this.globalDiscountPercentInput.set('')
    if (this.cart.remainingAmount() > 0) {
      this.paymentAmount.set(String(this.cart.remainingAmount()))
    }
  }

  /** Cierra sin vender: descarta los pagos capturados. No cierra mientras guarda. */
  close(): void {
    if (this.isSaving()) return
    this.isOpen.set(false)
    this.cart.clearPayments()
    this.paymentAmount.set('')
    this.paymentReference.set('')
    this.paymentError.set(null)
    this.saleError.set(null)
  }

  /** Deja el cobro listo para la siguiente venta (el carrito lo limpia la página). */
  resetAfterSale(): void {
    this.globalDiscountInput.set('')
    this.globalDiscountPercentInput.set('')
    this.discountMode.set('amount')
    this.discountReason.set('')
    this.paymentAmount.set('')
    this.paymentReference.set('')
    this.paymentMethod.set('cash')
    this.isOpen.set(false)
  }

  setGlobalDiscount(event: Event): void {
    const value = (event.target as HTMLInputElement).value.replace(/\D/g, '')
    this.globalDiscountInput.set(value)
    this.cart.setGlobalDiscount(value === '' ? 0 : Number.parseInt(value, 10))
  }

  setGlobalDiscountPercent(event: Event): void {
    const digits = (event.target as HTMLInputElement).value.replace(/\D/g, '')
    const clamped = digits === '' ? '' : String(Math.min(100, Number.parseInt(digits, 10)))
    this.globalDiscountPercentInput.set(clamped)
    const percent = clamped === '' ? 0 : Number.parseInt(clamped, 10)
    this.cart.setGlobalDiscount(Math.round((this.cart.totals().subtotal * percent) / 100))
  }

  setDiscountMode(mode: 'amount' | 'percent'): void {
    if (this.discountMode() === mode) return
    this.discountMode.set(mode)

    // Al cambiar de modo, refleja el monto actual del carrito en el input
    // que se va a mostrar (la fuente de verdad sigue siendo el monto en pesos).
    const amount = this.cart.globalDiscount()
    const subtotal = this.cart.totals().subtotal
    if (mode === 'percent') {
      const percent = subtotal > 0 ? Math.round((amount / subtotal) * 100) : 0
      this.globalDiscountPercentInput.set(percent > 0 ? String(percent) : '')
    } else {
      this.globalDiscountInput.set(amount > 0 ? String(amount) : '')
    }
  }

  setDiscountReason(event: Event): void {
    this.discountReason.set((event.target as HTMLInputElement).value)
  }

  clearGlobalDiscount(): void {
    this.globalDiscountInput.set('')
    this.globalDiscountPercentInput.set('')
    this.cart.setGlobalDiscount(0)
  }

  setPaymentAmount(event: Event): void {
    const value = (event.target as HTMLInputElement).value.replace(/\D/g, '')
    this.paymentAmount.set(value)
    this.paymentError.set(null)
  }

  setPaymentReference(event: Event): void {
    this.paymentReference.set((event.target as HTMLInputElement).value)
  }

  selectPaymentMethod(method: PaymentMethod): void {
    this.paymentMethod.set(method)
    this.paymentError.set(null)
    // El efectivo no lleva referencia: limpiamos cualquier valor previo.
    if (!requiresReference(method)) {
      this.paymentReference.set('')
    }
  }

  addPayment(): void {
    const amount = Number.parseInt(this.paymentAmount().replace(/\D/g, ''), 10)
    this.registerPayment(amount)
  }

  /** "Monto exacto": arma y agrega el faltante actual en un solo paso. */
  addExactPayment(): void {
    this.registerPayment(this.cart.remainingAmount())
  }

  /**
   * Arma la entrada de pago con el helper de dominio (descarta referencia si es
   * efectivo, normaliza vacíos, valida amount > 0) y la agrega al carrito. Tras
   * agregar reprellena el input con el nuevo faltante y limpia la referencia.
   */
  private registerPayment(amount: number): void {
    const entry = buildPaymentEntry({
      metodo: this.paymentMethod(),
      amount,
      referencia: this.paymentReference(),
    })
    if (!entry) return

    // Tarjeta (ADR 0024): `amount` es la parte de la venta que cubre; el
    // recargo va aparte y por el datáfono pasa la suma, dentro de los límites
    // de Nequi.
    if (entry.metodo === 'card') {
      if (entry.amount > this.cart.remainingAmount()) {
        this.paymentError.set('Con tarjeta se cobra como máximo lo que falta de la venta')
        return
      }
      const charge = calculateCardCharge(entry.amount, this.cardFee())
      const limitError = validateCardChargeAmount(charge.chargeAmount)
      if (limitError) {
        this.paymentError.set(limitError)
        return
      }
      this.cart.addPayment({ ...entry, cardSurcharge: charge.surcharge })
    } else {
      this.cart.addPayment(entry)
    }
    this.paymentError.set(null)
    this.paymentReference.set('')

    const remaining = this.cart.remainingAmount()
    this.paymentAmount.set(remaining > 0 ? String(remaining) : '')
  }
}
