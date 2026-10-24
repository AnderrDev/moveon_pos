import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core'
import { Gift, LucideAngularModule, UserRound } from 'lucide-angular'
import { PAYMENT_METHOD_OPTIONS } from '@/shared/lib/payment-methods'
import type { PaymentMethod } from '@/shared/types'
import { DialogComponent } from '@angular-app/shared/organisms/dialog.component'
import { PosCartStore } from '@angular-app/features/pos/presentation/services/pos-cart.store'
import { PosCheckoutStore } from '@angular-app/features/pos/presentation/services/pos-checkout.store'
import { MoneyPipe } from '@angular-app/shared/pipes/money.pipe'
import { PaymentLabelPipe } from '@angular-app/shared/pipes/payment-label.pipe'
import { ButtonComponent } from '@angular-app/shared/atoms/button.component'

/**
 * Diálogo de cobro del POS: resumen, cliente, descuento global, pagos,
 * tirilla y confirmación. El estado vive en `PosCheckoutStore` y el carrito en
 * `PosCartStore` (ambos los provee `PosPage`); confirmar la venta lo orquesta
 * la página, que recibe `confirm`.
 */
@Component({
  selector: 'mo-pos-checkout-dialog',
  standalone: true,
  imports: [ButtonComponent, PaymentLabelPipe, MoneyPipe, LucideAngularModule, DialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    <mo-dialog [open]="true" title="Cobrar venta" width="sm" [busy]="checkout.isSaving()" (closed)="closed.emit()">
        <div class="space-y-4">
          <div class="bg-muted/50 rounded-xl px-4 py-3">
            <p class="text-muted-foreground mb-2 text-xs font-semibold">
              Resumen de compra
            </p>
            <div class="border-border/50 mb-2.5 space-y-1 border-b pb-2.5">
              @for (item of cart.items(); track item.key) {
                <div class="flex items-start justify-between gap-2">
                  <span class="min-w-0 flex-1 text-sm leading-snug">
                    {{ item.nombre }}
                    <span class="text-muted-foreground">&nbsp;×&nbsp;{{ item.quantity }}</span>
                  </span>
                  <div class="shrink-0 text-right">
                    <span class="text-sm font-semibold tabular-nums">{{ (item.total | money) }}</span>
                    @if (item.descuentoTotal > 0) {
                      <span class="text-destructive ml-1.5 text-[11px] tabular-nums">
                        −{{ (item.descuentoTotal | money) }}
                      </span>
                    }
                  </div>
                </div>
              }
            </div>
            @if (cart.totals().discountTotal > 0) {
              <div class="flex justify-between text-sm">
                <span class="text-muted-foreground">Descuentos</span>
                <span class="text-destructive font-medium"
                  >−{{ (cart.totals().discountTotal | money) }}</span
                >
              </div>
            }
            <div class="flex justify-between text-sm">
              <span class="text-muted-foreground">Total venta</span>
              <span class="font-semibold">{{ (cart.totals().total | money) }}</span>
            </div>
            @if (cart.totalPaid() > 0) {
              <div class="flex justify-between text-sm">
                <span class="text-muted-foreground">Pagado</span>
                <span class="font-semibold text-emerald-600">{{ (cart.totalPaid() | money) }}</span>
              </div>
            }
            @if (cart.remainingAmount() > 0) {
              <div class="mt-1 flex justify-between text-sm font-semibold">
                <span>Falta</span>
                <span class="text-destructive">{{ (cart.remainingAmount() | money) }}</span>
              </div>
            }
            @if (cart.change() > 0) {
              <div class="mt-1 flex justify-between font-bold">
                <span>Cambio</span>
                <span class="text-foreground">{{ (cart.change() | money) }}</span>
              </div>
            }
          </div>

          <!-- Cliente: última oportunidad de asociarlo antes de confirmar
               (después del cobro solo un admin puede corregirlo, RN-S13). -->
          @if (cart.clienteId()) {
            <div class="bg-primary/5 border-primary/20 flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5">
              <span class="flex min-w-0 items-center gap-2">
                <lucide-angular [img]="icons.user" class="text-foreground h-4 w-4 shrink-0" aria-hidden="true" />
                <span class="min-w-0">
                  <span class="text-muted-foreground block text-xs font-semibold">Cliente</span>
                  <span class="block truncate text-sm font-semibold">{{ cart.clienteNombre() }}</span>
                </span>
              </span>
              <button
                type="button"
                (click)="pickCustomer.emit()"
                [disabled]="checkout.isSaving()"
                class="text-muted-foreground hover:text-foreground shrink-0 text-xs font-semibold underline disabled:opacity-50"
              >
                Cambiar
              </button>
            </div>
          } @else {
            <button
              type="button"
              (click)="pickCustomer.emit()"
              [disabled]="checkout.isSaving()"
              class="text-muted-foreground hover:border-primary hover:text-foreground flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed py-2.5 text-xs font-semibold transition-colors disabled:opacity-50"
            >
              <lucide-angular [img]="icons.user" class="h-4 w-4" aria-hidden="true" />
              Asociar cliente a esta venta
            </button>
          }

          @if (cart.payments().length > 0) {
            <div class="space-y-1.5">
              @for (payment of cart.payments(); track $index) {
                <div
                  class="bg-background flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                >
                  <span class="min-w-0">
                    <span class="block font-medium">{{ (payment.metodo | paymentLabel) }}</span>
                    @if (payment.referencia) {
                      <span class="text-muted-foreground block truncate text-[11px]">
                        Ref: {{ payment.referencia }}
                      </span>
                    }
                  </span>
                  <div class="flex shrink-0 items-center gap-3">
                    <span class="font-mono font-semibold tabular-nums">{{
                      (payment.amount | money)
                    }}</span>
                    <button
                      type="button"
                      (click)="cart.removePayment($index)"
                      class="text-muted-foreground hover:text-destructive"
                    >
                      ×
                    </button>
                  </div>
                </div>
              }
            </div>
          }

          <div class="space-y-2">
            <div class="flex items-center justify-between gap-2">
              <p class="text-muted-foreground text-xs font-semibold">
                Descuento global
              </p>
              <div class="flex gap-1" role="group" aria-label="Tipo de descuento">
                <button
                  type="button"
                  [attr.aria-pressed]="checkout.discountMode() === 'amount'"
                  [class]="discountModeClass('amount')"
                  (click)="checkout.setDiscountMode('amount')"
                >
                  $
                </button>
                <button
                  type="button"
                  [attr.aria-pressed]="checkout.discountMode() === 'percent'"
                  [class]="discountModeClass('percent')"
                  (click)="checkout.setDiscountMode('percent')"
                >
                  %
                </button>
              </div>
            </div>
            <div class="flex gap-2">
              @if (checkout.discountMode() === 'amount') {
                <input
                  type="text"
                  inputmode="numeric"
                  [value]="checkout.globalDiscountInput()"
                  (input)="checkout.setGlobalDiscount($event)"
                  placeholder="0"
                  class="border-input bg-card focus:ring-ring h-10 min-w-0 flex-1 rounded-lg border px-3 text-sm tabular-nums outline-none focus:ring-2"
                />
              } @else {
                <input
                  type="text"
                  inputmode="numeric"
                  [value]="checkout.globalDiscountPercentInput()"
                  (input)="checkout.setGlobalDiscountPercent($event)"
                  placeholder="0"
                  class="border-input bg-card focus:ring-ring h-10 min-w-0 flex-1 rounded-lg border px-3 text-sm tabular-nums outline-none focus:ring-2"
                />
              }
              @if (cart.globalDiscount() > 0) {
                <button
                  type="button"
                  (click)="checkout.clearGlobalDiscount()"
                  class="rounded-lg border px-4 text-xs font-semibold"
                >
                  Quitar
                </button>
              }
            </div>
            <p class="text-muted-foreground text-[11px]">
              @if (checkout.discountMode() === 'amount') {
                Monto en pesos distribuido entre los productos.
              } @else {
                Porcentaje sobre el subtotal ({{ (cart.totals().subtotal | money) }}), distribuido entre los productos.
              }
            </p>
          </div>

          @if (cart.loyaltyRedemption(); as redemption) {
            <div class="flex items-center justify-between rounded-xl border border-emerald-600/30 bg-emerald-500/10 px-3 py-2">
              <span class="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                <lucide-angular [img]="icons.gift" class="h-3.5 w-3.5" aria-hidden="true" />
                Canje MOVE ON Club
              </span>
              <span class="text-xs font-semibold text-emerald-700 tabular-nums">
                −{{ (redemption.amount | money) }}
              </span>
            </div>
          }

          @if (checkout.discretionaryDiscountTotal() > 0) {
            <div class="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/8 p-3">
              <div class="flex items-center justify-between gap-3">
                <p class="text-xs font-bold">Control del descuento</p>
                <span class="text-muted-foreground text-[11px] tabular-nums">
                  {{ (checkout.discretionaryDiscountTotal() | money) }} · {{ checkout.discountPercentage() }}%
                </span>
              </div>
              <input
                type="text"
                [value]="checkout.discountReason()"
                (input)="checkout.setDiscountReason($event)"
                maxlength="160"
                placeholder="Motivo del descuento"
                class="border-input bg-card focus:ring-ring h-10 w-full rounded-lg border px-3 text-sm outline-none focus:ring-2"
              />
              <p class="text-muted-foreground text-[11px]">
                El motivo queda en el historial y la auditoría.
              </p>
              @if (checkout.discountAuthorizationError()) {
                <p class="text-destructive text-xs font-semibold">
                  {{ checkout.discountAuthorizationError() }}
                </p>
              }
            </div>
          }

          <div class="space-y-3">
            <p class="text-muted-foreground text-xs font-semibold">
              Metodo de pago
            </p>
            <div class="grid grid-cols-2 gap-1.5 min-[420px]:grid-cols-3">
              @for (method of paymentMethods; track method.value) {
                <button
                  type="button"
                  (click)="checkout.selectPaymentMethod(method.value)"
                  [class]="paymentMethodClass(method.value)"
                >
                  {{ method.label }}
                </button>
              }
            </div>

            @if (checkout.showReference()) {
              <input
                type="text"
                [value]="checkout.paymentReference()"
                (input)="checkout.setPaymentReference($event)"
                placeholder="Referencia (opcional)"
                class="border-input bg-card focus:ring-ring h-10 w-full rounded-lg border px-3 text-sm outline-none focus:ring-2"
              />
            }

            <div class="flex gap-2">
              <input
                type="text"
                inputmode="numeric"
                [value]="checkout.paymentAmount()"
                (input)="checkout.setPaymentAmount($event)"
                [placeholder]="cart.remainingAmount() > 0 ? String(cart.remainingAmount()) : '0'"
                class="border-input bg-card focus:ring-ring h-10 min-w-0 flex-1 rounded-lg border px-3 text-sm outline-none focus:ring-2"
              />
              <button
                type="button"
                (click)="checkout.addPayment()"
                class="rounded-lg border px-4 text-sm font-semibold"
              >
                Agregar
              </button>
            </div>

            @if (cart.remainingAmount() > 0) {
              <button
                type="button"
                (click)="checkout.addExactPayment()"
                class="text-muted-foreground hover:border-primary hover:text-foreground w-full rounded-lg border border-dashed py-2 text-xs transition-colors"
              >
                Monto exacto: {{ (cart.remainingAmount() | money) }}
              </button>
            }
          </div>

          <div class="space-y-2">
            <p class="text-muted-foreground text-xs font-semibold">
              Tirilla de compra
            </p>
            <div class="grid grid-cols-2 gap-2" role="group" aria-label="Imprimir tirilla">
              <button
                type="button"
                [attr.aria-pressed]="checkout.imprimirEstaVenta()"
                [class]="receiptChoiceClass(true)"
                (click)="checkout.imprimirEstaVenta.set(true)"
              >
                Imprimir
              </button>
              <button
                type="button"
                [attr.aria-pressed]="!checkout.imprimirEstaVenta()"
                [class]="receiptChoiceClass(false)"
                (click)="checkout.imprimirEstaVenta.set(false)"
              >
                No imprimir
              </button>
            </div>
            <p class="text-muted-foreground text-[11px]">
              Esta eleccion aplica solamente a la venta actual.
            </p>
          </div>

          <div class="space-y-2">
            <p class="text-muted-foreground text-xs font-semibold">
              Caja fuerte
            </p>
            <button
              type="button"
              (click)="openCashDrawer.emit()"
              [disabled]="openingCashDrawer()"
              class="text-muted-foreground hover:border-primary hover:text-foreground w-full rounded-lg border border-dashed py-2 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            >
              {{ openingCashDrawer() ? 'Abriendo caja fuerte...' : 'Abrir caja fuerte' }}
            </button>
          </div>

          @if (checkout.saleError()) {
            <p class="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-sm">
              {{ checkout.saleError() }}
            </p>
          }

          <div class="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <mo-button variant="outline" [disabled]="checkout.isSaving()" (click)="closed.emit()">Cancelar</mo-button>
            <mo-button
              [disabled]="!checkout.canConfirm()"
              [loading]="checkout.isSaving()"
              loadingText="Guardando venta..."
              (click)="confirm.emit()"
            >
              Confirmar · {{ (cart.totals().total | money) }}
            </mo-button>
          </div>
        </div>
    </mo-dialog>
  `,
})
export class PosCheckoutDialogComponent {
  readonly cart = inject(PosCartStore)
  readonly checkout = inject(PosCheckoutStore)

  readonly openingCashDrawer = input(false)

  readonly closed = output<void>()
  readonly confirm = output<void>()
  readonly pickCustomer = output<void>()
  readonly openCashDrawer = output<void>()

  readonly icons = { gift: Gift, user: UserRound }
  readonly paymentMethods = PAYMENT_METHOD_OPTIONS
  readonly String = String

  discountModeClass(mode: 'amount' | 'percent'): string {
    const active = this.checkout.discountMode() === mode
    return [
      'h-8 min-w-9 rounded-md border px-2.5 text-xs font-semibold transition-colors',
      active
        ? 'border-primary bg-primary text-primary-foreground shadow-sm'
        : 'border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground',
    ].join(' ')
  }

  paymentMethodClass(method: PaymentMethod): string {
    const active = this.checkout.paymentMethod() === method
    return [
      'min-h-10 rounded-lg border px-2 py-2 text-xs font-medium transition-colors',
      active
        ? 'border-primary bg-primary text-primary-foreground'
        : 'border-border bg-background hover:bg-muted',
    ].join(' ')
  }

  receiptChoiceClass(printReceipt: boolean): string {
    const active = this.checkout.imprimirEstaVenta() === printReceipt
    return [
      'h-10 rounded-lg border px-3 text-sm font-semibold transition-colors',
      active
        ? 'border-primary bg-primary text-primary-foreground shadow-sm'
        : 'border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground',
    ].join(' ')
  }
}
