import { ChangeDetectionStrategy, Component, input, output } from '@angular/core'
import { BadgeComponent } from '../../shared/ui/badge.component'
import { formatCurrency, formatTime, formatShortDate } from '@/shared/lib/format'
import { getPaymentMethodLabel } from '@/shared/lib/payment-methods'
import type { Sale } from '@/modules/sales/domain/entities/sale.entity'

/**
 * Bloque "Detalle de ventas" expandible: lista de ventas del período con
 * resumen colapsado y detalle (items, pagos, registro) al expandir.
 *
 * El estado de expansión vive en el padre (`ReportesPage`) — este componente
 * es puramente presentacional, recibe `expandedSaleId` y emite `toggleSale`.
 */
@Component({
  selector: 'mo-sale-detail-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent],
  template: `
    <div>
      <h3 class="font-display mb-3 text-sm font-bold tracking-wide uppercase">
        Detalle de ventas
      </h3>
      @if (sales().length === 0) {
        <p class="text-muted-foreground text-sm">Sin ventas en el período.</p>
      } @else {
        <div class="space-y-3">
          @for (sale of sales(); track sale.id) {
            <article
              class="border-border bg-card overflow-hidden rounded-2xl border transition-shadow"
              [class.border-destructive]="sale.status === 'voided'"
              [class.shadow-md]="isExpanded(sale)"
            >
              <button
                type="button"
                class="hover:bg-muted/30 focus:ring-ring w-full p-4 text-left transition-colors focus:ring-2 focus:outline-none sm:p-5"
                [attr.aria-expanded]="isExpanded(sale)"
                [attr.aria-controls]="'report-sale-' + sale.id"
                (click)="toggleSale.emit(sale)"
              >
                <div class="flex items-start justify-between gap-4">
                  <div class="min-w-0">
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="font-mono text-sm font-black">{{ sale.saleNumber }}</span>
                      @if (sale.status === 'voided') {
                        <mo-badge variant="destructive">Anulada</mo-badge>
                      } @else {
                        <mo-badge variant="success">Completada</mo-badge>
                      }
                    </div>
                    <p class="text-muted-foreground mt-1 text-xs">
                      {{ saleDate(sale.createdAt) }} · {{ time(sale.createdAt) }}
                    </p>
                  </div>
                  <div class="flex shrink-0 items-center gap-3">
                    <div class="text-right">
                      <p class="text-muted-foreground text-[10px] font-bold tracking-wide uppercase">Total</p>
                      <p
                        class="font-display text-primary mt-0.5 text-lg font-black tabular-nums"
                        [class.text-muted-foreground]="sale.status === 'voided'"
                        [class.line-through]="sale.status === 'voided'"
                      >{{ money(sale.total) }}</p>
                    </div>
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      class="text-muted-foreground h-5 w-5 transition-transform duration-200"
                      [class.rotate-180]="isExpanded(sale)"
                      aria-hidden="true"
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </div>
                </div>

                <div class="mt-4 grid gap-2 text-xs sm:grid-cols-3">
                  <div class="bg-muted/50 min-w-0 rounded-xl px-3 py-2.5">
                    <p class="text-muted-foreground text-[10px] font-bold uppercase">Usuario</p>
                    <p class="mt-0.5 truncate font-semibold">{{ saleUserLabel(sale) }}</p>
                  </div>
                  <div class="bg-muted/50 rounded-xl px-3 py-2.5">
                    <p class="text-muted-foreground text-[10px] font-bold uppercase">Productos</p>
                    <p class="mt-0.5 font-semibold tabular-nums">
                      {{ saleItemCount(sale) }} unidades · {{ sale.items.length }} referencias
                    </p>
                  </div>
                  <div class="bg-muted/50 min-w-0 rounded-xl px-3 py-2.5">
                    <p class="text-muted-foreground text-[10px] font-bold uppercase">Pago</p>
                    <p class="mt-0.5 truncate font-semibold">{{ salePaymentMethods(sale) }}</p>
                  </div>
                </div>
              </button>

              @if (isExpanded(sale)) {
                <div [id]="'report-sale-' + sale.id" class="border-border bg-muted/20 border-t p-4 sm:p-5">
                  <div class="grid gap-4 md:grid-cols-[minmax(0,1.3fr)_minmax(16rem,0.7fr)]">
                    <section class="border-border bg-card overflow-hidden rounded-2xl border">
                      <div class="border-border flex items-center justify-between border-b px-4 py-3">
                        <h4 class="text-sm font-black">Productos vendidos</h4>
                        <span class="text-muted-foreground text-xs">{{ sale.items.length }} líneas</span>
                      </div>
                      <div class="divide-border divide-y">
                        @for (item of sale.items; track item.id) {
                          <div class="flex items-start gap-3 px-4 py-3.5">
                            <span class="bg-primary/10 text-primary inline-flex h-8 min-w-8 shrink-0 items-center justify-center rounded-lg px-2 text-xs font-black tabular-nums">
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
                                    Desc. producto −{{ money(saleItemDiscountTotal(item)) }}
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
                        <h4 class="text-sm font-black">Resumen de la venta</h4>
                        <dl class="mt-3 space-y-2 text-sm">
                          <div class="flex justify-between gap-3">
                            <dt class="text-muted-foreground">Subtotal</dt>
                            <dd class="font-semibold tabular-nums">{{ money(sale.subtotal) }}</dd>
                          </div>
                          <div class="flex justify-between gap-3">
                            <dt class="text-muted-foreground">Descuentos por producto</dt>
                            <dd class="font-semibold tabular-nums">{{ sale.itemDiscountTotal > 0 ? '−' : '' }}{{ money(sale.itemDiscountTotal) }}</dd>
                          </div>
                          @if (sale.globalDiscountTotal > 0) {
                            <div class="flex justify-between gap-3">
                              <dt class="text-muted-foreground">Descuento global</dt>
                              <dd class="font-semibold tabular-nums">−{{ money(sale.globalDiscountTotal) }}</dd>
                            </div>
                          }
                          @if (sale.discountReason) {
                            <div class="border-border border-t pt-2">
                              <dt class="text-muted-foreground text-xs">Motivo del descuento</dt>
                              <dd class="mt-1 text-xs font-semibold">{{ sale.discountReason }}</dd>
                            </div>
                          }
                          <div class="flex justify-between gap-3">
                            <dt class="text-muted-foreground">IVA incluido</dt>
                            <dd class="font-semibold tabular-nums">{{ money(sale.taxTotal) }}</dd>
                          </div>
                          <div class="border-border flex justify-between gap-3 border-t pt-3">
                            <dt class="font-black">Total</dt>
                            <dd class="text-primary text-lg font-black tabular-nums">{{ money(sale.total) }}</dd>
                          </div>
                        </dl>
                      </section>

                      <section class="border-border bg-card rounded-2xl border p-4">
                        <h4 class="text-sm font-black">Pagos recibidos</h4>
                        <div class="mt-3 space-y-2.5">
                          @for (payment of sale.payments; track payment.id) {
                            <div class="flex items-start justify-between gap-3 text-sm">
                              <div class="min-w-0 flex-1">
                                <p class="font-semibold">{{ paymentLabel(payment.metodo) }}</p>
                                @if (payment.referencia) {
                                  <p class="text-muted-foreground mt-0.5 text-[11px]">
                                    Ref. {{ payment.referencia }}
                                  </p>
                                }
                              </div>
                              <span class="font-bold tabular-nums">{{ money(payment.amount) }}</span>
                            </div>
                          }
                        </div>
                        <dl class="border-border mt-3 space-y-2 border-t pt-3 text-sm">
                          <div class="flex justify-between gap-3">
                            <dt class="text-muted-foreground">Total recibido</dt>
                            <dd class="font-bold tabular-nums">{{ money(saleTotalPaid(sale)) }}</dd>
                          </div>
                          <div class="flex justify-between gap-3">
                            <dt class="font-black">Cambio entregado</dt>
                            <dd class="text-primary font-black tabular-nums">{{ money(sale.change) }}</dd>
                          </div>
                        </dl>
                      </section>

                      <section class="border-border bg-card rounded-2xl border p-4">
                        <h4 class="text-sm font-black">Registro</h4>
                        <dl class="mt-3 space-y-2 text-xs">
                          <div class="flex justify-between gap-3">
                            <dt class="text-muted-foreground">Usuario</dt>
                            <dd class="max-w-44 truncate text-right font-semibold">{{ saleUserLabel(sale) }}</dd>
                          </div>
                          <div class="flex justify-between gap-3">
                            <dt class="text-muted-foreground">Cliente</dt>
                            <dd class="max-w-44 truncate text-right font-semibold">{{ saleCustomerLabel(sale) }}</dd>
                          </div>
                          <div class="flex justify-between gap-3">
                            <dt class="text-muted-foreground">Fecha y hora</dt>
                            <dd class="text-right font-semibold">{{ saleDate(sale.createdAt) }} · {{ time(sale.createdAt) }}</dd>
                          </div>
                          @if (sale.status === 'voided') {
                            <div class="border-destructive/20 mt-3 border-t pt-3">
                              <dt class="text-destructive font-bold">Motivo de anulación</dt>
                              <dd class="text-muted-foreground mt-1 leading-relaxed">{{ sale.voidedReason || 'Sin motivo registrado' }}</dd>
                            </div>
                          }
                        </dl>
                      </section>
                    </div>
                  </div>
                </div>
              }
            </article>
          }
        </div>
      }
    </div>
  `,
})
export class SaleDetailListComponent {
  readonly sales = input.required<Sale[]>()
  readonly expandedSaleId = input.required<string | null>()
  readonly toggleSale = output<Sale>()

  isExpanded(sale: Sale): boolean {
    return this.expandedSaleId() === sale.id
  }

  money(v: number): string {
    return formatCurrency(v)
  }

  time(d: Date): string {
    return formatTime(d)
  }

  saleDate(d: Date): string {
    return formatShortDate(d)
  }

  paymentLabel(metodo: string): string {
    return getPaymentMethodLabel(metodo)
  }

  saleUserLabel(sale: Sale): string {
    return sale.cashierEmail || `Cajero ${sale.cashierId.slice(0, 8)}`
  }

  saleCustomerLabel(sale: Sale): string {
    return (
      sale.clienteNombre ||
      (sale.clienteId ? `Cliente ${sale.clienteId.slice(0, 8)}` : 'Consumidor final')
    )
  }

  saleItemCount(sale: Sale): number {
    return sale.items.reduce((acc, i) => acc + i.quantity, 0)
  }

  salePaymentMethods(sale: Sale): string {
    const methods = [...new Set(sale.payments.map((p) => getPaymentMethodLabel(p.metodo)))]
    return methods.join(' + ') || 'Sin pago registrado'
  }

  saleTotalPaid(sale: Sale): number {
    return sale.payments.reduce((sum, p) => sum + p.amount, 0)
  }

  saleItemDiscountTotal(item: Sale['items'][number]): number {
    return item.discountAmount * item.quantity
  }
}
