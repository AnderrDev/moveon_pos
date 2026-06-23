import { ChangeDetectionStrategy, Component, input, output } from '@angular/core'
import { formatCurrency, formatShortDate, formatTime } from '@/shared/lib/format'
import { getPaymentMethodLabel } from '@/shared/lib/payment-methods'
import type { Sale } from '@/modules/sales/domain/entities/sale.entity'
import type { PaymentMethod } from '@/shared/types'

/**
 * Detalle completo de una venta: productos, resumen de totales, pagos y registro.
 * Reutilizado por el historial de ventas del POS y la tabla de ventas del turno en Caja.
 */
@Component({
  selector: 'mo-sale-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid gap-4 md:grid-cols-[minmax(0,1.3fr)_minmax(16rem,0.7fr)]">
      <section class="border-border bg-card overflow-hidden rounded-2xl border">
        <div class="border-border flex items-center justify-between border-b px-4 py-3">
          <h3 class="text-sm font-black">Productos vendidos</h3>
          <span class="text-muted-foreground text-xs">{{ sale().items.length }} líneas</span>
        </div>
        <div class="divide-border divide-y">
          @for (item of sale().items; track item.id) {
            <div class="flex items-start gap-3 px-4 py-3.5">
              <span
                class="bg-primary/10 text-primary inline-flex h-8 min-w-8 shrink-0 items-center justify-center rounded-lg px-2 text-xs font-black tabular-nums"
              >
                {{ item.quantity }}×
              </span>
              <div class="min-w-0 flex-1">
                <p class="text-sm leading-snug font-bold">{{ item.productoNombre }}</p>
                <p class="text-muted-foreground mt-1 text-xs">
                  {{ money(item.unitPrice) }} c/u
                  @if (item.productoSku) {
                    · SKU {{ item.productoSku }}
                  }
                </p>
                <div class="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
                  @if (item.discountAmount > 0) {
                    <span class="text-emerald-700">
                      Desc. producto −{{ money(itemDiscountTotal(item)) }}
                    </span>
                  }
                  @if (item.globalDiscountAmount > 0) {
                    <span class="text-amber-700">
                      Desc. global −{{ money(item.globalDiscountAmount) }}
                    </span>
                  }
                  @if (item.taxRate > 0) {
                    <span class="text-muted-foreground">
                      IVA {{ item.taxRate }}% incluido: {{ money(item.taxAmount) }}
                    </span>
                  }
                </div>
              </div>
              <p class="shrink-0 text-sm font-black tabular-nums">{{ money(item.total) }}</p>
            </div>
          }
        </div>
      </section>

      <div class="space-y-4">
        <section class="border-border bg-card rounded-2xl border p-4">
          <h3 class="text-sm font-black">Resumen de la venta</h3>
          <dl class="mt-3 space-y-2 text-sm">
            <div class="flex justify-between gap-3">
              <dt class="text-muted-foreground">Subtotal</dt>
              <dd class="font-semibold tabular-nums">{{ money(sale().subtotal) }}</dd>
            </div>
            <div class="flex justify-between gap-3">
              <dt class="text-muted-foreground">Descuentos por producto</dt>
              <dd class="font-semibold tabular-nums">
                {{ sale().itemDiscountTotal > 0 ? '−' : '' }}{{ money(sale().itemDiscountTotal) }}
              </dd>
            </div>
            @if (sale().globalDiscountTotal > 0) {
              <div class="flex justify-between gap-3">
                <dt class="text-muted-foreground">Descuento global</dt>
                <dd class="font-semibold tabular-nums">−{{ money(sale().globalDiscountTotal) }}</dd>
              </div>
            }
            @if (sale().discountReason) {
              <div class="border-border border-t pt-2">
                <dt class="text-muted-foreground text-xs">Motivo del descuento</dt>
                <dd class="mt-1 text-xs font-semibold">{{ sale().discountReason }}</dd>
              </div>
            }
            <div class="flex justify-between gap-3">
              <dt class="text-muted-foreground">IVA incluido</dt>
              <dd class="font-semibold tabular-nums">{{ money(sale().taxTotal) }}</dd>
            </div>
            <div class="border-border flex justify-between gap-3 border-t pt-3">
              <dt class="font-black">Total</dt>
              <dd class="text-primary text-lg font-black tabular-nums">{{ money(sale().total) }}</dd>
            </div>
          </dl>
        </section>

        <section class="border-border bg-card rounded-2xl border p-4">
          <h3 class="text-sm font-black">Pagos recibidos</h3>
          <div class="mt-3 space-y-2.5">
            @for (payment of sale().payments; track payment.id) {
              <div class="flex items-start justify-between gap-3 text-sm">
                <div class="min-w-0 flex-1">
                  <p class="font-semibold">{{ paymentLabel(payment.metodo) }}</p>
                  @if (payment.referencia) {
                    <p class="text-muted-foreground mt-0.5 text-[11px]">
                      Ref. {{ payment.referencia }}
                    </p>
                  }
                </div>
                <div class="flex shrink-0 items-center gap-2">
                  <span class="font-bold tabular-nums">{{ money(payment.amount) }}</span>
                  @if (
                    sale().status === 'completed' && canCorrectPayment() && cashSessionIsOpen()
                  ) {
                    <button
                      type="button"
                      class="text-muted-foreground hover:text-primary border-border hover:border-primary rounded-lg border px-2 py-1 text-[11px] font-semibold transition-colors"
                      (click)="
                        correctPaymentRequested.emit({
                          paymentId: payment.id,
                          currentMetodo: payment.metodo,
                        })
                      "
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
              <dd class="font-bold tabular-nums">{{ money(totalPaid()) }}</dd>
            </div>
            <div class="flex justify-between gap-3">
              <dt class="font-bold">Cambio entregado</dt>
              <dd class="text-primary font-black tabular-nums">{{ money(sale().change) }}</dd>
            </div>
          </dl>
        </section>

        <section class="border-border bg-card rounded-2xl border p-4">
          <h3 class="text-sm font-black">Registro</h3>
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
              <dd class="text-right font-semibold">{{ date() }} · {{ time() }}</dd>
            </div>
            @if (sale().status === 'voided') {
              <div class="border-destructive/20 mt-3 border-t pt-3">
                <dt class="text-destructive font-bold">Motivo de anulación</dt>
                <dd class="text-muted-foreground mt-1 leading-relaxed">
                  {{ sale().voidedReason || 'Sin motivo registrado' }}
                </dd>
              </div>
            }
          </dl>
        </section>
      </div>
    </div>
  `,
})
export class SaleDetailComponent {
  readonly sale = input.required<Sale>()
  /** Habilita el botón "Corregir" en pagos. Por defecto deshabilitado (solo lectura). */
  readonly canCorrectPayment = input<boolean>(false)
  readonly cashSessionIsOpen = input<boolean>(false)
  readonly correctPaymentRequested = output<{
    paymentId: string
    currentMetodo: PaymentMethod
  }>()

  money(v: number): string {
    return formatCurrency(v)
  }

  date(): string {
    return formatShortDate(this.sale().createdAt)
  }

  time(): string {
    return formatTime(this.sale().createdAt)
  }

  paymentLabel(metodo: string): string {
    return getPaymentMethodLabel(metodo)
  }

  totalPaid(): number {
    return this.sale().payments.reduce((sum, payment) => sum + payment.amount, 0)
  }

  itemDiscountTotal(item: Sale['items'][number]): number {
    return item.discountAmount * item.quantity
  }

  cashierLabel(): string {
    const sale = this.sale()
    return sale.cashierEmail || `Usuario ${sale.cashierId.slice(0, 8)}`
  }

  customerLabel(): string {
    const sale = this.sale()
    return (
      sale.clienteNombre ||
      (sale.clienteId ? `Cliente ${sale.clienteId.slice(0, 8)}` : 'Consumidor final')
    )
  }
}
