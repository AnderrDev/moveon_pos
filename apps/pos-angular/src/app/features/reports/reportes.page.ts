import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core'
import { getErrorMessage } from '@/shared/lib/error-message'
import { PageHeaderComponent } from '../../shared/layout/page-header.component'
import { ButtonComponent } from '../../shared/ui/button.component'
import { EmptyStateComponent } from '../../shared/feedback/empty-state.component'
import { ReportsService, type DailyReport, type StockReportRow } from './reports.service'
import { DailyKpiCardsComponent } from './daily-kpi-cards.component'
import { DiscountControlTableComponent } from './discount-control-table.component'
import { PaymentAndTopProductsComponent } from './payment-and-top-products.component'
import { TopProductsTableComponent } from './top-products-table.component'
import { CashierBreakdownListComponent } from './cashier-breakdown-list.component'
import { CashClosuresTableComponent } from './cash-closures-table.component'
import { SalesTrendTablesComponent } from './sales-trend-tables.component'
import { SaleDetailListComponent } from './sale-detail-list.component'
import { ProductSalesSearchComponent } from './product-sales-search.component'
import { AccountingSummaryComponent } from './accounting-summary.component'
import { StockReportTableComponent } from './stock-report-table.component'
import { SessionService } from '../../core/auth/session.service'
import { TiendaInfoService } from '../../core/tienda/tienda-info.service'
import { DEFAULT_TIMEZONE } from '@/modules/reports/domain/services/day-range'
import type { Sale } from '@/modules/sales/domain/entities/sale.entity'
import { ToastService } from '../../shared/feedback/toast.service'
import { ExcelExportService } from '../../shared/export/excel-export.service'
import { buildDailyReportWorkbook, buildStockReportWorkbook } from './report-export'
import { isoDate, resolvePreset, type Preset, type TabId } from './report-period.helpers'

@Component({
  selector: 'mo-reportes-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeaderComponent,
    ButtonComponent,
    EmptyStateComponent,
    DailyKpiCardsComponent,
    DiscountControlTableComponent,
    PaymentAndTopProductsComponent,
    TopProductsTableComponent,
    CashierBreakdownListComponent,
    CashClosuresTableComponent,
    SalesTrendTablesComponent,
    ProductSalesSearchComponent,
    SaleDetailListComponent,
    AccountingSummaryComponent,
    StockReportTableComponent,
  ],
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
          <mo-daily-kpi-cards [report]="d" />
          <mo-discount-control-table [report]="d" />
          <mo-payment-and-top-products [paymentBreakdown]="d.paymentBreakdown" />
          <mo-top-products-table [productSales]="d.productSales" />
          <mo-cashier-breakdown-list [cashierBreakdown]="d.cashierBreakdown" />
          <mo-cash-closures-table [sessions]="d.sessions" />
          <mo-sales-trend-tables [hourlySales]="d.hourlySales" [dailySales]="d.dailySales" />
          <mo-product-sales-search [saleItems]="d.saleItems" />
          <mo-sale-detail-list
            [sales]="d.sales"
            [expandedSaleId]="expandedSaleId()"
            (toggleSale)="toggleSale($event)"
          />
        }
      } @else if (tab() === 'accounting') {
        @if (daily(); as d) {
          <mo-accounting-summary [report]="d" [fromIso]="fromIso()" [toIso]="toIso()" />
        }
      } @else {
        <mo-stock-report-table [rows]="stock()" />
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
    const { from, to } = resolvePreset(this.fromIso(), preset)
    this.fromIso.set(from)
    this.toIso.set(to)
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

  toggleSale(sale: Sale): void {
    this.expandedSaleId.update((current) => (current === sale.id ? null : sale.id))
  }
}
