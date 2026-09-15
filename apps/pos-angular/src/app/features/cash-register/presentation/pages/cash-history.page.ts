import { ChangeDetectionStrategy, Component, inject, signal, OnDestroy } from '@angular/core'
import { RouterLink } from '@angular/router'
import { SessionService } from '@angular-app/core/auth/session.service'
import { TiendaInfoService } from '@angular-app/core/tienda/tienda-info.service'
import { PageHeaderComponent } from '@angular-app/shared/molecules/page-header.component'
import { ButtonComponent } from '@angular-app/shared/atoms/button.component'
import { SkeletonComponent } from '@angular-app/shared/atoms/skeleton.component'
import { ToastService } from '@angular-app/shared/organisms/toast/toast.service'
import { ExcelExportService } from '@angular-app/shared/services/export/excel-export.service'
import { buildTurnSalesWorkbook } from '@angular-app/shared/services/export/turn-sales-export'
import { CashRegisterRepository } from '../../domain/repositories/cash-register.repository'
import { SaleRepository } from '@angular-app/features/sales/domain/repositories/sale.repository'
import type { Sale } from '@angular-app/features/sales/domain/entities/sale.entity'
import type { CashSession, CashMovement } from '../../domain/entities/cash-session.entity'
import type { CashCloser, CashHistoryPage } from '../../domain/services/cash-history'
import { CashHistoryFiltersComponent } from '../components/cash-history-filters.component'
import { CashHistoryTableComponent } from '../components/cash-history-table.component'
import { CashSessionDetailDrawer } from '../components/cash-session-detail.drawer'
import { CashHistoryFormPresenter } from '../presenters/cash-history-form.presenter'
import { toCashHistoryQuery } from '../forms/cash-history-form.mapper'
import type { CashHistoryFormValue } from '../forms/cash-history-form.factory'
import { LatestRequest } from '../services/cash-history-request-state'
@Component({
 selector: 'mo-cash-history-page', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush,
 imports: [RouterLink, PageHeaderComponent, ButtonComponent, SkeletonComponent, CashHistoryFiltersComponent, CashHistoryTableComponent, CashSessionDetailDrawer],
 providers: [CashHistoryFormPresenter],
 template: `
  <section class="flex min-w-0 flex-col gap-4">
    <mo-page-header title="Historial de caja" subtitle="Busca cierres y revisa ventas, retiros y responsables."><a routerLink="/caja" class="focus:ring-ring rounded-lg px-3 py-2 text-sm font-semibold underline underline-offset-4 focus:ring-2">Volver a Caja</a></mo-page-header>
    @if (initialized()) { <mo-cash-history-filters [presenter]="presenter" [closers]="closers()" (applied)="applyFilters()" (cleared)="clearFilters()" /> }
    @if (loading()) { <div role="status" aria-label="Cargando historial"><mo-skeleton heightClass="h-72" /></div> }
    @else if (loadError()) { <div role="alert" class="text-destructive"><p>{{ loadError() }}</p><mo-button variant="outline" (click)="retryHistory()">Reintentar</mo-button></div> }
    @else { <mo-cash-history-table [page]="result()" [timezone]="timezone()" (selected)="selectSession($event)" (pageChanged)="load($event)" /> }
    <mo-cash-session-detail [session]="selectedSession()" [sales]="sales()" [movements]="movements()" [loading]="detailLoading()" [error]="detailError()" [exporting]="exporting()" [timezone]="timezone()" (closed)="closeDetail()" (retried)="retryDetail()" (exportRequested)="exportTurn()" />
  </section>
 `,
})
export class CashHistoryPageComponent implements OnDestroy {
 private readonly repo = inject(CashRegisterRepository)
 private readonly salesRepo = inject(SaleRepository)
 private readonly session = inject(SessionService)
 private readonly tiendaInfo = inject(TiendaInfoService)
 private readonly exporter = inject(ExcelExportService)
 private readonly toast = inject(ToastService)
 private readonly requests = new LatestRequest()
 private readonly detailRequests = new LatestRequest()
 private applied: CashHistoryFormValue | null = null
 readonly presenter = inject(CashHistoryFormPresenter)
 readonly result = signal<CashHistoryPage>({ items: [], total: 0, page: 1, pageSize: 20 })
 readonly closers = signal<CashCloser[]>([])
 readonly timezone = signal('America/Bogota')
 readonly loading = signal(true)
 readonly initialized = signal(false)
 readonly loadError = signal<string | null>(null)
 readonly selectedSession = signal<CashSession | null>(null)
 readonly sales = signal<Sale[]>([])
 readonly movements = signal<CashMovement[]>([])
 readonly detailLoading = signal(false)
 readonly detailError = signal<string | null>(null)
 readonly exporting = signal(false)
 constructor() { void this.init() }
 private async init(): Promise<void> {
   try {
     const auth = await this.session.getAuthContext()
     if (!auth || auth.rol !== 'admin') throw new Error('Solo administración puede consultar el historial.')
     const info = await this.tiendaInfo.get(auth.tiendaId)
     this.timezone.set(info.timezone)
     const today = new Intl.DateTimeFormat('en-CA', { timeZone: info.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
     this.presenter.reset(today)
     this.applied = this.presenter.validate()
     this.closers.set(await this.repo.listCashClosers(auth.tiendaId))
     this.initialized.set(true)
     await this.load(1)
   } catch { this.loadError.set('No se pudo cargar el historial. Reintenta la consulta.'); this.loading.set(false) }
 }
 applyFilters(): void {
   const value = this.presenter.validate()
   if (!value) return
   this.applied = value
   void this.load(1)
 }
 retryHistory(): void { if (this.initialized()) void this.load(this.result().page); else void this.init() }
 clearFilters(): void { this.presenter.reset(); this.applyFilters() }
 async load(page: number): Promise<void> {
   const token = this.requests.begin()
   this.loading.set(true); this.loadError.set(null)
   try {
     const auth = await this.session.getAuthContext()
     if (!auth || auth.rol !== 'admin') throw new Error('Sin permisos')
     const value = this.applied ?? this.presenter.validate()
     if (!value) return
     const result = await this.repo.listClosedSessionsPage(toCashHistoryQuery(value, { tiendaId: auth.tiendaId, timezone: this.timezone(), page }))
     if (this.requests.isCurrent(token)) this.result.set(result)
   } catch { if (this.requests.isCurrent(token)) this.loadError.set('No se pudo cargar el historial. Reintenta la consulta.') }
   finally { if (this.requests.isCurrent(token)) this.loading.set(false) }
 }
 async selectSession(selected: CashSession): Promise<void> {
   const token = this.detailRequests.begin()
   this.selectedSession.set(selected); this.sales.set([]); this.movements.set([])
   this.detailLoading.set(true); this.detailError.set(null)
   try {
     const auth = await this.session.getAuthContext()
     if (!auth || auth.rol !== 'admin' || auth.tiendaId !== selected.tiendaId) throw new Error('Sin permisos')
     const [movements, sales] = await Promise.all([this.repo.listMovements(selected.id), this.salesRepo.listBySession(selected.id, auth.tiendaId)])
     if (this.detailRequests.isCurrent(token)) { this.movements.set(movements); this.sales.set(sales) }
   } catch { if (this.detailRequests.isCurrent(token)) this.detailError.set('No se pudieron cargar las ventas y movimientos.') }
   finally { if (this.detailRequests.isCurrent(token)) this.detailLoading.set(false) }
 }
 closeDetail(): void { this.detailRequests.begin(); this.selectedSession.set(null) }
 retryDetail(): void { const selected = this.selectedSession(); if (selected) void this.selectSession(selected) }
 async exportTurn(): Promise<void> {
   if (this.detailLoading() || this.detailError() || this.exporting()) return
   const selected = this.selectedSession()
   if (!selected) return
   this.exporting.set(true)
   try { await this.exporter.download(buildTurnSalesWorkbook(selected, this.sales(), this.movements())) }
   catch { this.toast.error('No se pudo generar el Excel del turno.') }
   finally { this.exporting.set(false) }
 }
 ngOnDestroy(): void { this.requests.begin(); this.detailRequests.begin() }
}
