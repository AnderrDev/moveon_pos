import { ChangeDetectionStrategy, Component, input, output } from '@angular/core'
import { formatShortDate, formatTime } from '@/shared/lib/format'
import type { Sale } from '@angular-app/features/sales/domain/entities/sale.entity'
import { MoneyPipe } from '@angular-app/shared/pipes/money.pipe'
import { PaymentLabelPipe } from '@angular-app/shared/pipes/payment-label.pipe'

/**
 * Detalle de una venta (productos, resumen, pagos y registro). Compartido por
 * `mo-sale-detail-list` (/reportes, /caja) y el historial de ventas del POS,
 * que antes lo tenían copiado. Con `canCorrectPayment` muestra "Corregir" en
 * cada pago de una venta completada y emite `correctPayment`.
 */
@Component({
  selector: 'mo-sale-detail-body',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MoneyPipe, PaymentLabelPipe],
  template: `
    <div class="grid gap-4 md:grid-cols-[minmax(0,1.3fr)_minmax(16rem,0.7fr)]">
      <section class="border-border bg-card overflow-hidden rounded-2xl border">
        <div class="border-border flex items-center justify-between border-b px-4 py-3">
          <h4 class="text-sm font-black">Productos vendidos</h4>
          <span class="text-muted-foreground text-xs">{{ sale().items.length }} líneas</span>
        </div>
        <div class="divide-border divide-y">
          @for (item of sale().items; track item.id) {
            <div class="flex items-start gap-3 px-4 py-3.5">
              <span class="bg-primary/10 text-foreground inline-flex h-8 min-w-8 shrink-0 items-center justify-center rounded-lg px-2 text-xs font-black tabular-nums">
                {{ item.quantity }}×
              </span>
              <div class="min-w-0 flex-1">
                <p class="text-sm leading-snug font-bold">{{ item.productoNombre }}</p>
                @if (item.optionNombre) {
                  <p class="text-foreground text-[11px] font-semibold">
                    {{ item.optionNombre }}
                  </p>
                }
                <p class="text-muted-foreground mt-1 text-xs">
                  {{ (item.unitPrice | money) }} c/u
                  @if (item.productoSku) {
                    · SKU {{ item.productoSku }}
                  }
                </p>
                <div class="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
                  @if (item.discountAmount > 0) {
                    <span class="text-emerald-700">
                      Desc. producto −{{ (itemDiscountTotal(item) | money) }}
                    </span>
                  }
                  @if (item.globalDiscountAmount > 0) {
                    <span class="text-amber-700">
                      Desc. global −{{ (item.globalDiscountAmount | money) }}
                    </span>
                  }
                </div>
              </div>
              <p class="shrink-0 text-sm font-black tabular-nums">{{ (item.total | money) }}</p>
            </div>
          }
        </div>
      </section>

      <div class="space-y-4">
        <section class="border-border bg-card rounded-2xl border p-4">
          <h4 class="text-sm font-black">Resumen de la venta</h4>
          <dl class="mt-3 space-y-2 text-sm">
            <div class="flex justify-between gap-3">
              <dt class="text-muted-foreground">Subtotal</dt>
              <dd class="font-semibold tabular-nums">{{ (sale().subtotal | money) }}</dd>
            </div>
            <div class="flex justify-between gap-3">
              <dt class="text-muted-foreground">Descuentos por producto</dt>
              <dd class="font-semibold tabular-nums">{{ sale().itemDiscountTotal > 0 ? '−' : '' }}{{ (sale().itemDiscountTotal | money) }}</dd>
            </div>
            @if (sale().globalDiscountTotal > 0) {
              <div class="flex justify-between gap-3">
                <dt class="text-muted-foreground">Descuento global</dt>
                <dd class="font-semibold tabular-nums">−{{ (sale().globalDiscountTotal | money) }}</dd>
              </div>
            }
            @if (sale().discountReason) {
              <div class="border-border border-t pt-2">
                <dt class="text-muted-foreground text-xs">Motivo del descuento</dt>
                <dd class="mt-1 text-xs font-semibold">{{ sale().discountReason }}</dd>
              </div>
            }
            <div class="border-border flex justify-between gap-3 border-t pt-3">
              <dt class="font-black">Total</dt>
              <dd class="text-foreground text-lg font-black tabular-nums">{{ (sale().total | money) }}</dd>
            </div>
            @if (sale().cardSurcharge > 0) {
              <div class="flex justify-between gap-3">
                <dt class="text-muted-foreground">Recargo pago con tarjeta</dt>
                <dd class="font-semibold tabular-nums">+{{ (sale().cardSurcharge | money) }}</dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-muted-foreground">Total cobrado al cliente</dt>
                <dd class="font-bold tabular-nums">{{ (sale().total + sale().cardSurcharge | money) }}</dd>
              </div>
            }
          </dl>
        </section>

        <section class="border-border bg-card rounded-2xl border p-4">
          <h4 class="text-sm font-black">Pagos recibidos</h4>
          <div class="mt-3 space-y-2.5">
            @for (payment of sale().payments; track payment.id) {
              <div class="flex items-start justify-between gap-3 text-sm">
                <div class="min-w-0 flex-1">
                  <p class="font-semibold">{{ (payment.metodo | paymentLabel) }}</p>
                  @if (payment.referencia) {
                    <p class="text-muted-foreground mt-0.5 text-[11px]">
                      Ref. {{ payment.referencia }}
                    </p>
                  }
                  @if (payment.cardSurcharge > 0) {
                    <p class="text-muted-foreground mt-0.5 text-[11px] tabular-nums">
                      {{ (payment.amount | money) }} + recargo {{ (payment.cardSurcharge | money) }}
                    </p>
                  }
                </div>
                <div class="flex shrink-0 items-center gap-2">
                <span class="font-bold tabular-nums">{{ (payment.amount + payment.cardSurcharge | money) }}</span>
                <!-- Un pago con recargo no se corrige (RN-PG09): se anula la venta. -->
                @if (canCorrectPayment() && sale().status === 'completed' && payment.cardSurcharge === 0) {
                  <button
                    type="button"
                    class="text-muted-foreground hover:text-foreground border-border hover:border-primary rounded-lg border px-2 py-1 text-[11px] font-semibold transition-colors"
                    (click)="correctPayment.emit({ paymentId: payment.id, metodo: payment.metodo })"
                  >
                    Corregir
                  </button>
                }
              </div>
              </div>
            }
          </div>
          <dl class="border-border mt-3 space-y-2 border-t pt-3 text-sm">
            <div class="flex justify-between gap-3">
              <dt class="text-muted-foreground">Total recibido</dt>
              <dd class="font-bold tabular-nums">{{ (totalPaid() | money) }}</dd>
            </div>
            <div class="flex justify-between gap-3">
              <dt class="font-black">Cambio entregado</dt>
              <dd class="text-foreground font-black tabular-nums">{{ (sale().change | money) }}</dd>
            </div>
          </dl>
        </section>

        <section class="border-border bg-card rounded-2xl border p-4">
          <h4 class="text-sm font-black">Registro</h4>
          <dl class="mt-3 space-y-2 text-xs">
            <div class="flex justify-between gap-3">
              <dt class="text-muted-foreground">Usuario</dt>
              <dd class="max-w-44 truncate text-right font-semibold">{{ cashierLabel() }}</dd>
            </div>
            <div class="flex justify-between gap-3">
              <dt class="text-muted-foreground">Cliente</dt>
              <dd class="max-w-44 truncate text-right font-semibold">{{ customerLabel() }}</dd>
            </div>
            <div class="flex justify-between gap-3">
              <dt class="text-muted-foreground">Fecha y hora</dt>
              <dd class="text-right font-semibold">{{ date(sale().createdAt) }} · {{ time(sale().createdAt) }}</dd>
            </div>
            @if (sale().status === 'voided') {
              <div class="border-destructive/20 mt-3 border-t pt-3">
                <dt class="text-destructive font-bold">Motivo de anulación</dt>
                <dd class="text-muted-foreground mt-1 leading-relaxed">{{ sale().voidedReason || 'Sin motivo registrado' }}</dd>
              </div>
            }
          </dl>
        </section>
      </div>
    </div>
  `,
})
export class SaleDetailBodyComponent {
  readonly sale = input.required<Sale>()
  readonly canCorrectPayment = input(false)
  readonly correctPayment = output<{ paymentId: string; metodo: Sale['payments'][number]['metodo'] }>()

  time(d: Date): string {
    return formatTime(d)
  }

  date(d: Date): string {
    return formatShortDate(d)
  }

  cashierLabel(): string {
    const sale = this.sale()
    return sale.cashierEmail || `Cajero ${sale.cashierId.slice(0, 8)}`
  }

  customerLabel(): string {
    const sale = this.sale()
    return sale.clienteNombre || (sale.clienteId ? `Cliente ${sale.clienteId.slice(0, 8)}` : 'Consumidor final')
  }

  totalPaid(): number {
    return this.sale().payments.reduce((sum, p) => sum + p.amount + p.cardSurcharge, 0)
  }

  itemDiscountTotal(item: Sale['items'][number]): number {
    return item.discountAmount * item.quantity
  }
}
