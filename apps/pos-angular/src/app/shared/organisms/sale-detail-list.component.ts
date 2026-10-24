import { ChangeDetectionStrategy, Component, input, output } from '@angular/core'
import { BadgeComponent } from '../atoms/badge.component'
import { SaleDetailBodyComponent } from './sale-detail-body.component'
import { formatTime, formatShortDate } from '@/shared/lib/format'
import { getPaymentMethodLabel } from '@/shared/lib/payment-methods'
import type { Sale } from '@angular-app/features/sales/domain/entities/sale.entity'
import { MoneyPipe } from '@angular-app/shared/pipes/money.pipe'

/**
 * Bloque "Detalle de ventas" expandible: lista de ventas con resumen
 * colapsado y detalle (items, pagos, registro) al expandir.
 *
 * Compartido entre `/reportes` (ventas del período) y `/caja` (ventas del
 * turno, abierto o histórico). El estado de expansión vive en el padre —
 * este componente es puramente presentacional, recibe `expandedSaleId` y
 * emite `toggleSale`.
 */
@Component({
  selector: 'mo-sale-detail-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MoneyPipe, BadgeComponent, SaleDetailBodyComponent],
  template: `
    <div>
      <h3 class="font-display mb-3 text-sm font-bold tracking-wide uppercase">
        {{ title() }}
      </h3>
      @if (sales().length === 0) {
        <p class="text-muted-foreground text-sm">{{ emptyMessage() }}</p>
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
                [attr.aria-controls]="'sale-detail-' + sale.id"
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
                      >{{ (sale.total | money) }}</p>
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
                <div [id]="'sale-detail-' + sale.id" class="border-border bg-muted/20 border-t p-4 sm:p-5">
                  <mo-sale-detail-body [sale]="sale" />
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
  readonly title = input<string>('Detalle de ventas')
  readonly emptyMessage = input<string>('Sin ventas en el período.')
  readonly toggleSale = output<Sale>()

  isExpanded(sale: Sale): boolean {
    return this.expandedSaleId() === sale.id
  }

  time(d: Date): string {
    return formatTime(d)
  }

  saleDate(d: Date): string {
    return formatShortDate(d)
  }

  saleUserLabel(sale: Sale): string {
    return sale.cashierEmail || `Cajero ${sale.cashierId.slice(0, 8)}`
  }

  saleItemCount(sale: Sale): number {
    return sale.items.reduce((acc, i) => acc + i.quantity, 0)
  }

  salePaymentMethods(sale: Sale): string {
    const methods = [...new Set(sale.payments.map((p) => getPaymentMethodLabel(p.metodo)))]
    return methods.join(' + ') || 'Sin pago registrado'
  }

}
