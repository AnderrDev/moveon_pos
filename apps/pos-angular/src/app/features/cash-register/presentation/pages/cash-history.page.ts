import { afterNextRender, ChangeDetectionStrategy, Component, ElementRef, Injector, inject, signal, OnDestroy, viewChild } from '@angular/core'
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
import type { CashCloser, CashHistoryPage, CashHistoryDaysPage } from '../../domain/services/cash-history'
import { CashHistoryDaysComponent } from '../components/cash-history-days.component'
import { CashHistoryFiltersComponent } from '../components/cash-history-filters.component'
import { CashHistoryTableComponent } from '../components/cash-history-table.component'
import { CashSessionDetailDrawer } from '../components/cash-session-detail.drawer'
import { CashHistoryFormPresenter } from '../presenters/cash-history-form.presenter'
import { toCashHistoryQuery } from '../forms/cash-history-form.mapper'
import type { CashHistoryFormValue } from '../forms/cash-history-form.factory'
import { LatestRequest } from '../services/cash-history-request-state'
@Component({
 selector: 'mo-cash-history-page', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush,
 imports: [RouterLink, PageHeaderComponent, ButtonComponent, SkeletonComponent, CashHistoryFiltersComponent, CashHistoryDaysComponent, CashHistoryTableComponent, CashSessionDetailDrawer],
 providers: [CashHistoryFormPresenter],
 template: `
  <section class="flex min-w-0 flex-col gap-4">
    <mo-page-header title="Historial de caja" subtitle="Busca cierres y revisa ventas, retiros y responsables."><a routerLink="/caja" class="focus:ring-ring rounded-lg px-3 py-2 text-sm font-semibold underline underline-offset-4 focus:ring-2">Volver a Caja</a></mo-page-header>
    @if (!selectedDay()) {
    <h2 #summaryHeading tabindex="-1" class="sr-only">Resumen diario</h2>
    @if (initialized()) { <mo-cash-history-filters [presenter]="presenter" [closers]="closers()" (applied)="applyFilters()" (cleared)="clearFilters()" /> }
    @if (loading()) { <div role="status" aria-label="Cargando historial"><mo-skeleton heightClass="h-72" /></div> }
    @else if (loadError()) { <div role="alert" class="text-destructive"><p>{{ loadError() }}</p><mo-button variant="outline" (click)="retryHistory()">Reintentar</mo-button></div> }
    @else { <mo-cash-history-days [page]="result()" [selectedDay]="selectedDay()" (selected)="selectDay($event)" (pageChanged)="load($event)" /> }
    }
    @if (selectedDay(); as day) {
      <section class="min-w-0" aria-label="Turnos del día">
       <mo-button class="mb-4 block" variant="outline" size="sm" (click)="backToSummary()">Volver al resumen</mo-button>
       <h2 #dayHeading tabindex="-1" class="mb-2 text-lg font-semibold">Turnos del {{ day.split('-').reverse().join('/') }}</h2>
       <p class="text-muted-foreground mb-4 text-sm">Horarios de apertura y cierre en {{ timezone() }}. Se mantienen los filtros de responsable y cuadre aplicados.</p>
       @if (turnsLoading()) { <mo-skeleton heightClass="h-48" /> }
       @else if (turnsError()) { <p role="alert">{{ turnsError() }}</p><mo-button variant="outline" (click)="loadTurns(turns().page)">Reintentar turnos</mo-button> }
       @else { <mo-cash-history-table [page]="turns()" [timezone]="timezone()" (selected)="selectSession($event)" (pageChanged)="loadTurns($event)" /> }
      </section>
    }
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
 private readonly turnRequests = new LatestRequest()
 private readonly injector = inject(Injector)
 private readonly dayHeading = viewChild<ElementRef<HTMLElement>>('dayHeading')
 private readonly summaryHeading = viewChild<ElementRef<HTMLElement>>('summaryHeading')
 private applied: CashHistoryFormValue | null = null
 readonly presenter = inject(CashHistoryFormPresenter)
 readonly result = signal<CashHistoryDaysPage>({ items: [], total: 0, page: 1, pageSize: 20 })
 readonly turns = signal<CashHistoryPage>({ items: [], total: 0, page: 1, pageSize: 20 })
 readonly selectedDay = signal<string | null>(null)
 readonly turnsLoading = signal(false)
 readonly turnsError = signal<string | null>(null)
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
   this.turnRequests.begin(); this.selectedDay.set(null); this.closeDetail()
   this.loading.set(true); this.loadError.set(null)
   try {
     const auth = await this.session.getAuthContext()
     if (!auth || auth.rol !== 'admin') throw new Error('Sin permisos')
     const value = this.applied ?? this.presenter.validate()
     if (!value) return
     const result = await this.repo.listHistoryDays(toCashHistoryQuery(value, { tiendaId: auth.tiendaId, timezone: this.timezone(), page }))
     if (this.requests.isCurrent(token)) this.result.set(result)
   } catch { if (this.requests.isCurrent(token)) this.loadError.set('No se pudo cargar el historial. Reintenta la consulta.') }
   finally { if (this.requests.isCurrent(token)) this.loading.set(false) }
 }
 selectDay(day: string): void {
   this.turnRequests.begin(); this.closeDetail()
   if (this.selectedDay() === day) { this.selectedDay.set(null); return }
   this.selectedDay.set(day); void this.loadTurns(1)
   afterNextRender(() => this.dayHeading()?.nativeElement.focus(), { injector: this.injector })
 }
 backToSummary(): void {
   this.turnRequests.begin(); this.closeDetail(); this.selectedDay.set(null)
   afterNextRender(() => this.summaryHeading()?.nativeElement.focus(), { injector: this.injector })
 }
 async loadTurns(page: number): Promise<void> {
   const day = this.selectedDay()
   const value = this.applied
   if (!day || !value) return
   const token = this.turnRequests.begin()
   this.turnsLoading.set(true); this.turnsError.set(null)
   try {
     const auth = await this.session.getAuthContext()
     if (!auth || auth.rol !== 'admin') throw new Error('Sin permisos')
     const query = toCashHistoryQuery({ ...value, from: day, to: day }, { tiendaId: auth.tiendaId, timezone: this.timezone(), page })
     const result = await this.repo.listClosedSessionsPage(query)
     if (this.turnRequests.isCurrent(token)) this.turns.set(result)
   } catch { if (this.turnRequests.isCurrent(token)) this.turnsError.set('No se pudieron cargar los turnos del día.') }
   finally { if (this.turnRequests.isCurrent(token)) this.turnsLoading.set(false) }
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
 ngOnDestroy(): void { this.requests.begin(); this.detailRequests.begin(); this.turnRequests.begin() }
}
