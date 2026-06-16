import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core'
import { getErrorMessage } from '@/shared/lib/error-message'
import { PageHeaderComponent } from '../../shared/layout/page-header.component'
import { ButtonComponent } from '../../shared/ui/button.component'
import { BadgeComponent } from '../../shared/ui/badge.component'
import { EmptyStateComponent } from '../../shared/feedback/empty-state.component'
import { ReportsService, type DailyReport, type StockReportRow } from './reports.service'
import { SessionService } from '../../core/auth/session.service'
import { TiendaInfoService } from '../../core/tienda/tienda-info.service'
import { DEFAULT_TIMEZONE } from '@/modules/reports/domain/services/day-range'
import { formatCurrency, formatTime, formatShortDate } from '@/shared/lib/format'
import type { Sale } from '@/modules/sales/domain/entities/sale.entity'
import { getPaymentMethodLabel } from '@/shared/lib/payment-methods'
import { ToastService } from '../../shared/feedback/toast.service'
import { ExcelExportService } from '../../shared/export/excel-export.service'
import { buildDailyReportWorkbook, buildStockReportWorkbook } from './report-export'

function isoDate(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Lunes de la semana ISO que contiene `iso`. */
function weekStart(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  const day = d.getDay() // 0=Dom
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().slice(0, 10)
}

/** Primer día del mes de `iso`. */
function monthStart(iso: string): string {
  return iso.slice(0, 7) + '-01'
}

/** Último día del mes de `iso`. */
function monthEnd(iso: string): string {
  const [y, m] = iso.split('-').map(Number)
  return new Date(y, m, 0).toISOString().slice(0, 10)
}

/** Primer día del mes anterior al de `iso`. */
function prevMonthStart(iso: string): string {
  const [y, m] = iso.split('-').map(Number)
  const prev = m === 1 ? new Date(y - 1, 11, 1) : new Date(y, m - 2, 1)
  return prev.toISOString().slice(0, 10)
}

type TabId = 'daily' | 'accounting' | 'stock'
type Preset = 'today' | 'week' | 'month' | 'prev-month'

@Component({
  selector: 'mo-reportes-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, ButtonComponent, BadgeComponent, EmptyStateComponent],
  template: `
    <section class="flex h-full min-h-0 flex-col gap-4">
      <mo-page-header title="Reportes" subtitle="Ventas, contabilidad y stock">
        <mo-button
          variant="outline"
          [loading]="exporting()"
          loadingText="Generando..."
          [disabled]="!canExport()"
          (click)="exportCurrentReport()"
        >
          Descargar Excel
        </mo-button>
      </mo-page-header>

      <!-- Selector de período -->
      <div class="bg-card rounded-xl border p-3">
        <div class="flex flex-wrap items-center gap-2">
          <div class="flex items-center gap-2">
            <label class="text-muted-foreground text-xs font-semibold">Desde</label>
            <input
              type="date"
              [value]="fromIso()"
              (change)="onFromChange($event)"
              class="border-input bg-background focus:ring-ring h-9 rounded-lg border px-2.5 text-sm focus:ring-2 focus:outline-none"
            />
          </div>
          <div class="flex items-center gap-2">
            <label class="text-muted-foreground text-xs font-semibold">Hasta</label>
            <input
              type="date"
              [value]="toIso()"
              (change)="onToChange($event)"
              class="border-input bg-background focus:ring-ring h-9 rounded-lg border px-2.5 text-sm focus:ring-2 focus:outline-none"
            />
          </div>
          <div class="ml-auto flex gap-1">
            @for (p of presets; track p.id) {
              <button
                type="button"
                (click)="applyPreset(p.id)"
                [class]="presetClass(p.id)"
              >
                {{ p.label }}
              </button>
            }
            <mo-button size="sm" variant="outline" (click)="reload()">Actualizar</mo-button>
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <nav class="flex gap-1 text-sm">
        <button type="button" (click)="tab.set('daily')" [class]="tabClass('daily')">
          Ventas
        </button>
        <button type="button" (click)="tab.set('accounting')" [class]="tabClass('accounting')">
          Resumen contable
        </button>
        <button type="button" (click)="tab.set('stock')" [class]="tabClass('stock')">
          Stock
        </button>
      </nav>

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
          <!-- KPI cards -->
          <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <div class="bg-card rounded-xl border p-5">
              <p class="text-muted-foreground text-xs font-semibold uppercase">Total ventas</p>
              <p class="font-display mt-2 text-2xl font-bold tabular-nums">
                {{ money(d.totalVentas) }}
              </p>
              <p class="text-muted-foreground text-xs">{{ d.countVentas }} ventas</p>
            </div>
            <div class="rounded-xl border border-amber-500/30 bg-amber-500/8 p-5">
              <p class="text-xs font-semibold text-amber-800 uppercase">Descuentos</p>
              <p class="font-display mt-2 text-2xl font-bold tabular-nums">
                {{ money(d.discountTotal) }}
              </p>
              <p class="text-muted-foreground text-xs">
                {{ d.discountedSalesCount }} ventas · promedio
                {{ percent(d.averageDiscountPercentage) }}
              </p>
            </div>
            <div class="bg-card rounded-xl border p-5">
              <p class="text-muted-foreground text-xs font-semibold uppercase">Ticket promedio</p>
              <p class="font-display mt-2 text-2xl font-bold tabular-nums">
                {{ money(d.avgVenta) }}
              </p>
            </div>
            <div class="bg-card rounded-xl border p-5">
              <p class="text-muted-foreground text-xs font-semibold uppercase">IVA</p>
              <p class="font-display mt-2 text-2xl font-bold tabular-nums">
                {{ money(d.taxTotal) }}
              </p>
            </div>
            <div class="bg-card rounded-xl border p-5">
              <p class="text-muted-foreground text-xs font-semibold uppercase">Anuladas</p>
              <p class="font-display mt-2 text-2xl font-bold tabular-nums">{{ d.countAnuladas }}</p>
            </div>
          </div>

          <!-- Control de descuentos -->
          <div class="bg-card rounded-xl border border-amber-500/25 p-5">
            <div class="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 class="font-display text-sm font-bold tracking-wide uppercase">
                  Control de descuentos
                </h3>
                <p class="text-muted-foreground mt-1 text-xs">
                  Seguimiento por venta, origen y responsable.
                </p>
              </div>
              <div class="flex gap-4 text-right text-xs">
                <div>
                  <p class="text-muted-foreground">Por productos</p>
                  <p class="font-mono font-bold tabular-nums">{{ money(d.itemDiscountTotal) }}</p>
                </div>
                <div>
                  <p class="text-muted-foreground">Globales</p>
                  <p class="font-mono font-bold tabular-nums">{{ money(d.globalDiscountTotal) }}</p>
                </div>
              </div>
            </div>
            @if (d.discountedSalesCount === 0) {
              <p class="text-muted-foreground text-sm">No se aplicaron descuentos en este período.</p>
            } @else {
              <div class="overflow-auto">
                <table class="w-full min-w-[760px] text-sm">
                  <thead class="text-muted-foreground text-left text-xs uppercase">
                    <tr>
                      <th class="px-2 py-2">Venta</th>
                      <th class="px-2 py-2">Usuario</th>
                      <th class="px-2 py-2 text-right">Productos</th>
                      <th class="px-2 py-2 text-right">Global</th>
                      <th class="px-2 py-2 text-right">Total</th>
                      <th class="px-2 py-2 text-right">%</th>
                      <th class="px-2 py-2">Motivo</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y">
                    @for (sale of discountedSales(d); track sale.id) {
                      <tr>
                        <td class="px-2 py-2 font-mono text-xs">{{ sale.saleNumber }}</td>
                        <td class="px-2 py-2 text-xs">
                          {{ sale.cashierEmail ?? cashierLabel(sale.cashierId) }}
                        </td>
                        <td class="px-2 py-2 text-right tabular-nums">
                          {{ money(sale.itemDiscountTotal) }}
                        </td>
                        <td class="px-2 py-2 text-right tabular-nums">
                          {{ money(sale.globalDiscountTotal) }}
                        </td>
                        <td class="px-2 py-2 text-right font-bold tabular-nums">
                          {{ money(sale.discountTotal) }}
                        </td>
                        <td class="px-2 py-2 text-right tabular-nums">
                          {{ percent(sale.discountPercentage) }}
                        </td>
                        <td class="max-w-64 px-2 py-2 text-xs">
                          {{ sale.discountReason ?? 'Histórico sin motivo' }}
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </div>

          <!-- Por método de pago y top productos -->
          <div class="grid gap-4 md:grid-cols-2">
            <div class="bg-card rounded-xl border p-5">
              <h3 class="font-display mb-3 text-sm font-bold tracking-wide uppercase">
                Por método de pago
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
              <h3 class="font-display mb-3 text-sm font-bold tracking-wide uppercase">
                Top productos
              </h3>
              @if (d.topProducts.length === 0) {
                <p class="text-muted-foreground text-sm">Sin ventas registradas.</p>
              } @else {
                <ul class="space-y-2 text-sm">
                  @for (p of d.topProducts; track p.productId) {
                    <li class="flex justify-between">
                      <span class="truncate pr-3"
                        >{{ p.nombre }}
                        <span class="text-muted-foreground">× {{ p.qty }}</span></span
                      >
                      <span class="font-mono font-semibold tabular-nums">{{ money(p.total) }}</span>
                    </li>
                  }
                </ul>
              }
            </div>
          </div>

          <!-- Por cajero -->
          <div class="bg-card rounded-xl border p-5">
            <h3 class="font-display mb-3 text-sm font-bold tracking-wide uppercase">Por cajero</h3>
            @if (d.cashierBreakdown.length === 0) {
              <p class="text-muted-foreground text-sm">Sin ventas registradas.</p>
            } @else {
              <ul class="space-y-2 text-sm">
                @for (c of d.cashierBreakdown; track c.cashierId) {
                  <li class="flex justify-between gap-3">
                    <span class="truncate">
                      {{ cashierLabel(c.cashierId) }}
                      <span class="text-muted-foreground">
                        ({{ c.countCompleted }} ventas
                        @if (c.countVoided > 0) {
                          · {{ c.countVoided }} anuladas
                        }
                        )
                      </span>
                    </span>
                    <span class="text-right">
                      <span class="font-mono font-semibold tabular-nums">{{
                        money(c.totalVentas)
                      }}</span>
                      <span class="text-muted-foreground ml-2 font-mono text-xs tabular-nums">
                        IVA {{ money(c.taxTotal) }}
                      </span>
                    </span>
                  </li>
                }
              </ul>
            }
          </div>

          <!-- Cierres de caja -->
          @if (d.sessions.length > 0) {
            <div class="bg-card rounded-xl border p-5">
              <h3 class="font-display mb-3 text-sm font-bold tracking-wide uppercase">
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
                          @if (s.closedAt) {
                            → {{ time(s.closedAt) }}
                          }
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

          <!-- Detalle de ventas expandible -->
          <div>
            <h3 class="font-display mb-3 text-sm font-bold tracking-wide uppercase">
              Detalle de ventas
            </h3>
            @if (d.sales.length === 0) {
              <p class="text-muted-foreground text-sm">Sin ventas en el período.</p>
            } @else {
              <div class="space-y-3">
                @for (sale of d.sales; track sale.id) {
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
                      (click)="toggleSale(sale)"
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
                            <p class="text-muted-foreground text-[10px] font-bold tracking-wide uppercase">
                              Total
                            </p>
                            <p
                              class="font-display text-primary mt-0.5 text-lg font-black tabular-nums"
                              [class.text-muted-foreground]="sale.status === 'voided'"
                              [class.line-through]="sale.status === 'voided'"
                            >
                              {{ money(sale.total) }}
                            </p>
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
                      <div
                        [id]="'report-sale-' + sale.id"
                        class="border-border bg-muted/20 border-t p-4 sm:p-5"
                      >
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
                                  <dd class="font-semibold tabular-nums">
                                    {{ sale.itemDiscountTotal > 0 ? '−' : '' }}{{ money(sale.itemDiscountTotal) }}
                                  </dd>
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
                                  <dd class="text-right font-semibold">
                                    {{ saleDate(sale.createdAt) }} · {{ time(sale.createdAt) }}
                                  </dd>
                                </div>
                                @if (sale.status === 'voided') {
                                  <div class="border-destructive/20 mt-3 border-t pt-3">
                                    <dt class="text-destructive font-bold">Motivo de anulación</dt>
                                    <dd class="text-muted-foreground mt-1 leading-relaxed">
                                      {{ sale.voidedReason || 'Sin motivo registrado' }}
                                    </dd>
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
        }
      } @else if (tab() === 'accounting') {
        @if (daily(); as d) {
          <div class="grid gap-4 lg:grid-cols-2">

            <!-- Bloque de ingresos -->
            <div class="bg-card rounded-xl border p-6">
              <h3 class="font-display mb-1 text-sm font-bold tracking-wide uppercase">Ingresos</h3>
              <p class="text-muted-foreground mb-4 text-xs">
                {{ fromIso() === toIso() ? fromIso() : fromIso() + ' al ' + toIso() }}
                · {{ d.countVentas }} ventas completadas
              </p>
              <dl class="space-y-3 text-sm">
                <div class="flex justify-between gap-3">
                  <dt class="text-muted-foreground">Ingresos brutos</dt>
                  <dd class="font-semibold tabular-nums">{{ money(d.subtotalVentas) }}</dd>
                </div>
                <div class="flex justify-between gap-3 text-amber-800">
                  <dt>− Descuentos</dt>
                  <dd class="font-semibold tabular-nums">{{ money(d.discountTotal) }}</dd>
                </div>
                <div class="border-border flex justify-between gap-3 border-t pt-3">
                  <dt class="font-black">Ingresos netos</dt>
                  <dd class="text-primary text-xl font-black tabular-nums">
                    {{ money(d.totalVentas) }}
                  </dd>
                </div>
                <div class="flex justify-between gap-3 text-xs">
                  <dt class="text-muted-foreground">IVA incluido en ingresos netos</dt>
                  <dd class="font-semibold tabular-nums">{{ money(d.taxTotal) }}</dd>
                </div>
              </dl>
              @if (d.countAnuladas > 0) {
                <p class="text-muted-foreground mt-4 border-t pt-4 text-xs">
                  {{ d.countAnuladas }} venta{{ d.countAnuladas !== 1 ? 's' : '' }} anulada{{
                    d.countAnuladas !== 1 ? 's' : ''
                  }} (no incluidas en los totales)
                </p>
              }
            </div>

            <!-- Desglose IVA -->
            <div class="bg-card rounded-xl border p-6">
              <h3 class="font-display mb-1 text-sm font-bold tracking-wide uppercase">
                Desglose de IVA
              </h3>
              <p class="text-muted-foreground mb-4 text-xs">
                Por tasa — ventas completadas únicamente
              </p>
              @if (d.taxBreakdown.length === 0) {
                <p class="text-muted-foreground text-sm">Sin ventas en el período.</p>
              } @else {
                <div class="overflow-auto">
                  <table class="w-full text-sm">
                    <thead class="text-muted-foreground text-left text-xs uppercase">
                      <tr>
                        <th class="py-2 pr-4">Tasa</th>
                        <th class="py-2 pr-4 text-right">Base gravable</th>
                        <th class="py-2 pr-4 text-right">IVA generado</th>
                        <th class="py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y">
                      @for (row of d.taxBreakdown; track row.taxRate) {
                        <tr>
                          <td class="py-2.5 pr-4 font-bold">
                            @if (row.taxRate === 0) {
                              <span class="text-muted-foreground">Exento</span>
                            } @else {
                              {{ row.taxRate }}%
                            }
                          </td>
                          <td class="py-2.5 pr-4 text-right tabular-nums">
                            {{ money(row.baseAmount) }}
                          </td>
                          <td class="py-2.5 pr-4 text-right font-semibold tabular-nums">
                            @if (row.taxRate === 0) {
                              <span class="text-muted-foreground">—</span>
                            } @else {
                              {{ money(row.taxAmount) }}
                            }
                          </td>
                          <td class="py-2.5 text-right tabular-nums">
                            {{ money(row.baseAmount + row.taxAmount) }}
                          </td>
                        </tr>
                      }
                    </tbody>
                    <tfoot class="border-border border-t">
                      <tr>
                        <td class="pt-2.5 pr-4 font-black text-xs uppercase">Total</td>
                        <td class="pt-2.5 pr-4 text-right font-bold tabular-nums">
                          {{ money(d.subtotalVentas) }}
                        </td>
                        <td class="pt-2.5 pr-4 text-right font-bold tabular-nums">
                          {{ money(d.taxTotal) }}
                        </td>
                        <td class="pt-2.5 text-right font-bold tabular-nums">
                          {{ money(d.totalVentas) }}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              }
            </div>

            <!-- Por método de pago (cuadre bancario) -->
            <div class="bg-card rounded-xl border p-6">
              <h3 class="font-display mb-1 text-sm font-bold tracking-wide uppercase">
                Ingresos por método de pago
              </h3>
              <p class="text-muted-foreground mb-4 text-xs">Para cuadre bancario y de caja</p>
              @if (d.paymentBreakdown.length === 0) {
                <p class="text-muted-foreground text-sm">Sin pagos registrados.</p>
              } @else {
                <ul class="space-y-3 text-sm">
                  @for (p of d.paymentBreakdown; track p.metodo) {
                    <li class="flex items-center justify-between gap-3">
                      <div>
                        <p class="font-semibold">{{ paymentLabel(p.metodo) }}</p>
                        <p class="text-muted-foreground text-xs">{{ p.count }} transacciones</p>
                      </div>
                      <span class="font-mono text-base font-bold tabular-nums">
                        {{ money(p.total) }}
                      </span>
                    </li>
                  }
                </ul>
                <div class="border-border mt-4 flex justify-between border-t pt-3 text-sm">
                  <span class="font-black">Total recaudado</span>
                  <span class="font-mono font-black tabular-nums">{{ money(d.totalVentas) }}</span>
                </div>
              }
            </div>

            <!-- Top productos (para margen futuro) -->
            <div class="bg-card rounded-xl border p-6">
              <h3 class="font-display mb-1 text-sm font-bold tracking-wide uppercase">
                Productos más vendidos
              </h3>
              <p class="text-muted-foreground mb-4 text-xs">Top 5 por cantidad (ventas completadas)</p>
              @if (d.topProducts.length === 0) {
                <p class="text-muted-foreground text-sm">Sin ventas en el período.</p>
              } @else {
                <ul class="space-y-3 text-sm">
                  @for (p of d.topProducts; track p.productId) {
                    <li class="flex items-center justify-between gap-3">
                      <div class="min-w-0 flex-1">
                        <p class="truncate font-semibold">{{ p.nombre }}</p>
                        <p class="text-muted-foreground text-xs">{{ p.qty }} unidades</p>
                      </div>
                      <span class="font-mono font-bold tabular-nums">{{ money(p.total) }}</span>
                    </li>
                  }
                </ul>
              }
            </div>
          </div>
        }
      } @else {
        @if (stock().length === 0) {
          <mo-empty-state title="Sin productos" description="Crea productos para ver el reporte." />
        } @else {
          <div class="bg-card flex-1 overflow-auto rounded-xl border">
            <table class="w-full text-sm">
              <thead
                class="bg-muted/50 text-muted-foreground sticky top-0 text-left text-xs uppercase"
              >
                <tr>
                  <th class="px-4 py-3">Producto</th>
                  <th class="px-4 py-3">SKU</th>
                  <th class="px-4 py-3 text-right">Punto venta</th>
                  <th class="px-4 py-3 text-right">Bodega</th>
                  <th class="px-4 py-3 text-right">Total</th>
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
                      {{ row.puntoVentaStock }}
                    </td>
                    <td class="px-4 py-3 text-right font-semibold tabular-nums">
                      {{ row.bodegaStock }}
                    </td>
                    <td class="text-muted-foreground px-4 py-3 text-right tabular-nums">
                      {{ row.totalStock }}
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
  private readonly tiendaInfo = inject(TiendaInfoService)
  private readonly toast = inject(ToastService)
  private readonly excel = inject(ExcelExportService)

  readonly fromIso = signal(isoDate(new Date(), DEFAULT_TIMEZONE))
  readonly toIso = signal(isoDate(new Date(), DEFAULT_TIMEZONE))
  readonly activePreset = signal<Preset | null>('today')
  readonly tab = signal<TabId>('daily')
  readonly daily = signal<DailyReport | null>(null)
  readonly stock = signal<StockReportRow[]>([])
  readonly loading = signal(true)
  readonly loadError = signal<string | null>(null)
  readonly exporting = signal(false)
  readonly expandedSaleId = signal<string | null>(null)

  readonly presets: { id: Preset; label: string }[] = [
    { id: 'today', label: 'Hoy' },
    { id: 'week', label: 'Semana' },
    { id: 'month', label: 'Este mes' },
    { id: 'prev-month', label: 'Mes anterior' },
  ]

  constructor() {
    void this.initAndLoad()
  }

  private async initAndLoad(): Promise<void> {
    const timezone = await this.resolveTimezone()
    const today = isoDate(new Date(), timezone)
    this.fromIso.set(today)
    this.toIso.set(today)
    await this.reload()
  }

  money(v: number): string {
    return formatCurrency(v)
  }

  percent(value: number): string {
    return `${value.toFixed(2)}%`
  }

  discountedSales(report: DailyReport): DailyReport['salesDetail'] {
    return report.salesDetail.filter(
      (sale) => sale.status === 'completed' && sale.discountTotal > 0,
    )
  }

  time(d: Date): string {
    return formatTime(d)
  }

  paymentLabel(metodo: string): string {
    return getPaymentMethodLabel(metodo)
  }

  cashierLabel(id: string): string {
    return `Cajero ${id.slice(0, 8)}`
  }

  tabClass(value: TabId): string {
    return [
      'rounded-lg px-3 py-1.5 font-semibold transition-colors',
      this.tab() === value ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
    ].join(' ')
  }

  presetClass(id: Preset): string {
    return [
      'rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors',
      this.activePreset() === id ? 'bg-secondary text-secondary-foreground' : 'hover:bg-muted text-muted-foreground',
    ].join(' ')
  }

  canExport(): boolean {
    if (this.tab() === 'stock') return this.stock().length > 0
    return this.daily() !== null
  }

  applyPreset(preset: Preset): void {
    const today = this.fromIso()
    switch (preset) {
      case 'today':
        this.fromIso.set(today)
        this.toIso.set(today)
        break
      case 'week':
        this.fromIso.set(weekStart(today))
        this.toIso.set(today)
        break
      case 'month':
        this.fromIso.set(monthStart(today))
        this.toIso.set(today)
        break
      case 'prev-month': {
        const pm = prevMonthStart(today)
        this.fromIso.set(pm)
        this.toIso.set(monthEnd(pm))
        break
      }
    }
    this.activePreset.set(preset)
    void this.reload()
  }

  onFromChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value
    if (value) {
      this.fromIso.set(value)
      this.activePreset.set(null)
      if (value > this.toIso()) this.toIso.set(value)
      void this.reload()
    }
  }

  onToChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value
    if (value) {
      this.toIso.set(value)
      this.activePreset.set(null)
      if (value < this.fromIso()) this.fromIso.set(value)
      void this.reload()
    }
  }

  async exportCurrentReport(): Promise<void> {
    this.exporting.set(true)
    try {
      if (this.tab() === 'stock') {
        await this.excel.download(buildStockReportWorkbook(this.stock()))
      } else {
        const report = this.daily()
        if (!report) return
        await this.excel.download(
          buildDailyReportWorkbook(report, this.fromIso(), this.toIso()),
        )
      }
      this.toast.success('Reporte descargado en Excel')
    } catch (error) {
      this.toast.error(getErrorMessage(error, 'No se pudo generar el reporte'))
    } finally {
      this.exporting.set(false)
    }
  }

  async reload(): Promise<void> {
    this.loading.set(true)
    this.loadError.set(null)
    this.expandedSaleId.set(null)
    try {
      const auth = await this.session.getAuthContext()
      if (!auth) throw new Error('No autenticado')

      const [daily, stock] = await Promise.all([
        this.reportsService.getDailyReport(auth.tiendaId, this.fromIso(), this.toIso()),
        this.reportsService.getStockReport(auth.tiendaId),
      ])

      this.daily.set(daily)
      this.stock.set(stock)
    } catch (error) {
      this.loadError.set(getErrorMessage(error, 'Error al cargar reporte'))
    } finally {
      this.loading.set(false)
    }
  }

  private async resolveTimezone(): Promise<string> {
    try {
      const auth = await this.session.getAuthContext()
      if (!auth) return DEFAULT_TIMEZONE
      return (await this.tiendaInfo.get(auth.tiendaId)).timezone
    } catch {
      return DEFAULT_TIMEZONE
    }
  }

  saleDate(d: Date): string {
    return formatShortDate(d)
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

  isExpanded(sale: Sale): boolean {
    return this.expandedSaleId() === sale.id
  }

  toggleSale(sale: Sale): void {
    this.expandedSaleId.update((current) => (current === sale.id ? null : sale.id))
  }
}
