import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core'
import { PageHeaderComponent } from '../../shared/layout/page-header.component'
import { ButtonComponent } from '../../shared/ui/button.component'
import { BadgeComponent } from '../../shared/ui/badge.component'
import { EmptyStateComponent } from '../../shared/feedback/empty-state.component'
import { ReportsService, type DailyReport, type StockReportRow } from './reports.service'
import { SessionService } from '../../core/auth/session.service'
import { formatCurrency, formatTime } from '@/shared/lib/format'
import { getPaymentMethodLabel } from '@/shared/lib/payment-methods'

function todayIso(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

@Component({
  selector: 'mo-reportes-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeaderComponent,
    ButtonComponent,
    BadgeComponent,
    EmptyStateComponent,
  ],
  template: `
    <section class="flex h-full min-h-0 flex-col gap-4">
      <mo-page-header title="Reportes" subtitle="Reporte diario y stock">
        <input
          type="date"
          [value]="dateIso()"
          (change)="onDateChange($event)"
          class="border-input bg-card focus:ring-ring h-10 rounded-lg border px-3 text-sm focus:outline-none focus:ring-2"
        />
        <mo-button variant="outline" (click)="reload()">Actualizar</mo-button>
      </mo-page-header>

      <div class="grid gap-2">
        <nav class="flex gap-1 text-sm">
          <button
            type="button"
            (click)="tab.set('daily')"
            [class]="tabClass('daily')"
          >
            Reporte diario
          </button>
          <button type="button" (click)="tab.set('stock')" [class]="tabClass('stock')">
            Stock
          </button>
        </nav>
      </div>

      @if (loading()) {
        <div class="bg-card flex-1 animate-pulse rounded-xl border p-8">
          <div class="bg-muted/50 h-72 rounded-xl"></div>
        </div>
      } @else if (loadError()) {
        <mo-empty-state title="Error al cargar reporte" [description]="loadError()">
          <mo-button (click)="reload()">Reintentar</mo-button>
        </mo-empty-state>
      } @else if (tab() === 'daily') {
        @if (daily(); as d) {
          <div class="grid gap-4 md:grid-cols-4">
            <div class="bg-card rounded-xl border p-5">
              <p class="text-muted-foreground text-xs font-semibold uppercase">Total ventas</p>
              <p class="font-display mt-2 text-2xl font-bold tabular-nums">{{ money(d.totalVentas) }}</p>
              <p class="text-muted-foreground text-xs">{{ d.countVentas }} ventas</p>
            </div>
            <div class="bg-card rounded-xl border p-5">
              <p class="text-muted-foreground text-xs font-semibold uppercase">Ticket promedio</p>
              <p class="font-display mt-2 text-2xl font-bold tabular-nums">{{ money(d.avgVenta) }}</p>
            </div>
            <div class="bg-card rounded-xl border p-5">
              <p class="text-muted-foreground text-xs font-semibold uppercase">IVA</p>
              <p class="font-display mt-2 text-2xl font-bold tabular-nums">{{ money(d.taxTotal) }}</p>
            </div>
            <div class="bg-card rounded-xl border p-5">
              <p class="text-muted-foreground text-xs font-semibold uppercase">Anuladas</p>
              <p class="font-display mt-2 text-2xl font-bold tabular-nums">{{ d.countAnuladas }}</p>
            </div>
          </div>

          <div class="grid gap-4 md:grid-cols-2">
            <div class="bg-card rounded-xl border p-5">
              <h3 class="font-display mb-3 text-sm font-bold uppercase tracking-wide">
                Por metodo de pago
              </h3>
              @if (d.paymentBreakdown.length === 0) {
                <p class="text-muted-foreground text-sm">Sin pagos registrados.</p>
              } @else {
                <ul class="space-y-2 text-sm">
                  @for (p of d.paymentBreakdown; track p.metodo) {
                    <li class="flex justify-between">
                      <span>{{ paymentLabel(p.metodo) }} ({{ p.count }})</span>
                      <span class="font-mono font-semibold tabular-nums">{{ money(p.total) }}</span>
                    </li>
                  }
                </ul>
              }
            </div>

            <div class="bg-card rounded-xl border p-5">
              <h3 class="font-display mb-3 text-sm font-bold uppercase tracking-wide">
                Top productos
              </h3>
              @if (d.topProducts.length === 0) {
                <p class="text-muted-foreground text-sm">Sin ventas registradas.</p>
              } @else {
                <ul class="space-y-2 text-sm">
                  @for (p of d.topProducts; track p.productId) {
                    <li class="flex justify-between">
                      <span class="truncate pr-3">{{ p.nombre }} <span class="text-muted-foreground">× {{ p.qty }}</span></span>
                      <span class="font-mono font-semibold tabular-nums">{{ money(p.total) }}</span>
                    </li>
                  }
                </ul>
              }
            </div>
          </div>

          @if (d.sessions.length > 0) {
            <div class="bg-card rounded-xl border p-5">
              <h3 class="font-display mb-3 text-sm font-bold uppercase tracking-wide">
                Cierres de caja
              </h3>
              <div class="overflow-auto">
                <table class="w-full text-sm">
                  <thead class="text-muted-foreground text-xs uppercase">
                    <tr class="text-left">
                      <th class="px-2 py-2">Sesion</th>
                      <th class="px-2 py-2 text-right">Ventas esp.</th>
                      <th class="px-2 py-2 text-right">Ventas real</th>
                      <th class="px-2 py-2 text-right">Dif.</th>
                      <th class="px-2 py-2 text-right">Caja esp.</th>
                      <th class="px-2 py-2 text-right">Caja real</th>
                      <th class="px-2 py-2 text-right">Dif. caja</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y">
                    @for (s of d.sessions; track s.id) {
                      <tr>
                        <td class="text-muted-foreground px-2 py-2 text-xs">
                          {{ time(s.openedAt) }}
                          @if (s.closedAt) { → {{ time(s.closedAt) }} }
                        </td>
                        <td class="px-2 py-2 text-right tabular-nums">
                          {{ money(s.expectedSalesAmount) }}
                        </td>
                        <td class="px-2 py-2 text-right tabular-nums">
                          {{ s.actualSalesAmount !== null ? money(s.actualSalesAmount) : '—' }}
                        </td>
                        <td
                          class="px-2 py-2 text-right tabular-nums"
                          [class.text-destructive]="(s.salesDifference ?? 0) > 0"
                          [class.text-emerald-600]="(s.salesDifference ?? 0) < 0"
                        >
                          {{ s.salesDifference !== null ? money(s.salesDifference) : '—' }}
                        </td>
                        <td class="px-2 py-2 text-right tabular-nums">
                          {{ money(s.expectedCashAmount) }}
                        </td>
                        <td class="px-2 py-2 text-right tabular-nums">
                          {{ s.actualCashAmount !== null ? money(s.actualCashAmount) : '—' }}
                        </td>
                        <td
                          class="px-2 py-2 text-right tabular-nums"
                          [class.text-destructive]="(s.cashDifference ?? 0) > 0"
                          [class.text-emerald-600]="(s.cashDifference ?? 0) < 0"
                        >
                          {{ s.cashDifference !== null ? money(s.cashDifference) : '—' }}
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          }

          <div class="bg-card rounded-xl border p-5">
            <h3 class="font-display mb-3 text-sm font-bold uppercase tracking-wide">
              Detalle de ventas
            </h3>
            @if (d.salesDetail.length === 0) {
              <p class="text-muted-foreground text-sm">Sin ventas en la fecha.</p>
            } @else {
              <div class="overflow-auto">
                <table class="w-full text-sm">
                  <thead class="text-muted-foreground text-xs uppercase">
                    <tr class="text-left">
                      <th class="px-2 py-2">Hora</th>
                      <th class="px-2 py-2">No.</th>
                      <th class="px-2 py-2 text-right">Items</th>
                      <th class="px-2 py-2 text-right">Total</th>
                      <th class="px-2 py-2">Estado</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y">
                    @for (s of d.salesDetail; track s.id) {
                      <tr>
                        <td class="text-muted-foreground px-2 py-2 text-xs">
                          {{ time(s.createdAt) }}
                        </td>
                        <td class="px-2 py-2 font-mono text-xs">{{ s.saleNumber }}</td>
                        <td class="px-2 py-2 text-right tabular-nums">{{ s.itemCount }}</td>
                        <td class="px-2 py-2 text-right font-semibold tabular-nums">
                          {{ money(s.total) }}
                        </td>
                        <td class="px-2 py-2">
                          @if (s.status === 'voided') {
                            <mo-badge variant="destructive">Anulada</mo-badge>
                          } @else {
                            <mo-badge variant="success">OK</mo-badge>
                          }
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </div>
        }
      } @else {
        @if (stock().length === 0) {
          <mo-empty-state title="Sin productos" description="Crea productos para ver el reporte." />
        } @else {
          <div class="bg-card flex-1 overflow-auto rounded-xl border">
            <table class="w-full text-sm">
              <thead class="bg-muted/50 text-muted-foreground sticky top-0 text-left text-xs uppercase">
                <tr>
                  <th class="px-4 py-3">Producto</th>
                  <th class="px-4 py-3">SKU</th>
                  <th class="px-4 py-3 text-right">Stock</th>
                  <th class="px-4 py-3 text-right">Min</th>
                  <th class="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody class="divide-y">
                @for (row of stock(); track row.productId) {
                  <tr [class.bg-amber-50]="row.isLow">
                    <td class="px-4 py-3 font-semibold">{{ row.nombre }}</td>
                    <td class="text-muted-foreground px-4 py-3 font-mono text-xs">
                      {{ row.sku ?? '—' }}
                    </td>
                    <td class="px-4 py-3 text-right font-bold tabular-nums">
                      {{ row.currentStock }}
                    </td>
                    <td class="text-muted-foreground px-4 py-3 text-right tabular-nums">
                      {{ row.minimumStock }}
                    </td>
                    <td class="px-4 py-3">
                      @if (row.isLow) {
                        <mo-badge variant="warning">Stock bajo</mo-badge>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      }
    </section>
  `,
})
export class ReportesPage {
  private readonly reportsService = inject(ReportsService)
  private readonly session = inject(SessionService)

  readonly dateIso = signal(todayIso())
  readonly tab = signal<'daily' | 'stock'>('daily')
  readonly daily = signal<DailyReport | null>(null)
  readonly stock = signal<StockReportRow[]>([])
  readonly loading = signal(true)
  readonly loadError = signal<string | null>(null)

  readonly currentDate = computed(() => new Date(this.dateIso()))

  constructor() {
    void this.reload()
  }

  money(v: number): string {
    return formatCurrency(v)
  }

  time(d: Date): string {
    return formatTime(d)
  }

  paymentLabel(metodo: string): string {
    return getPaymentMethodLabel(metodo)
  }

  tabClass(value: 'daily' | 'stock'): string {
    return [
      'rounded-lg px-3 py-1.5 font-semibold transition-colors',
      this.tab() === value ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
    ].join(' ')
  }

  onDateChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value
    if (value) {
      this.dateIso.set(value)
      void this.reload()
    }
  }

  async reload(): Promise<void> {
    this.loading.set(true)
    this.loadError.set(null)
    try {
      const auth = await this.session.getAuthContext()
      if (!auth) throw new Error('No autenticado')

      const [daily, stock] = await Promise.all([
        this.reportsService.getDailyReport(auth.tiendaId, this.currentDate()),
        this.reportsService.getStockReport(auth.tiendaId),
      ])

      this.daily.set(daily)
      this.stock.set(stock)
    } catch (error) {
      this.loadError.set(error instanceof Error ? error.message : 'Error al cargar reporte')
    } finally {
      this.loading.set(false)
    }
  }
}
