import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core'
import { getErrorMessage } from '@/shared/lib/error-message'
import { RouterLink } from '@angular/router'
import { PageHeaderComponent } from '@angular-app/shared/molecules/page-header.component'
import { CardComponent } from '@angular-app/shared/atoms/card.component'
import { ButtonComponent } from '@angular-app/shared/atoms/button.component'
import { EmptyStateComponent } from '@angular-app/shared/molecules/empty-state.component'
import { CashRegisterRepository } from '@angular-app/features/cash-register/domain/repositories/cash-register.repository'
import type { PaymentBreakdown } from '@angular-app/features/cash-register/domain/repositories/cash-register.repository'
import { openCashSession } from '@angular-app/features/cash-register/domain/usecases/open-session.use-case'
import { voidCashMovement } from '@angular-app/features/cash-register/domain/usecases/void-movement.use-case'
import { SessionService } from '@angular-app/core/auth/session.service'
import { ToastService } from '@angular-app/shared/organisms/toast/toast.service'
import { AddMovementDialog } from '@angular-app/features/cash-register/presentation/dialogs/add-movement.dialog'
import {
  CloseSessionDialog,
  type ExpectedByMethod,
} from '@angular-app/features/cash-register/presentation/dialogs/close-session.dialog'
import { CorrectOpeningDialog } from '@angular-app/features/cash-register/presentation/dialogs/correct-opening.dialog'
import { CorrectMovementDialog } from '@angular-app/features/cash-register/presentation/dialogs/correct-movement.dialog'
import { SaleDetailListComponent } from '@angular-app/shared/organisms/sale-detail-list.component'
import { formatCurrency } from '@/shared/lib/format'
import { PAYMENT_FILTER_OPTIONS } from '@/shared/lib/payment-methods'
import type {
  CashMovement,
  CashSession,
} from '@angular-app/features/cash-register/domain/entities/cash-session.entity'
import type { Sale } from '@angular-app/features/sales/domain/entities/sale.entity'
import { SaleRepository } from '@angular-app/features/sales/domain/repositories/sale.repository'
import { ExcelExportService } from '@angular-app/shared/services/export/excel-export.service'
import { buildTurnSalesWorkbook } from '@angular-app/shared/services/export/turn-sales-export'
import { VoidReasonDialog } from '@angular-app/shared/organisms/void-reason/void-reason.dialog'
import { ReceiptPrintService } from '@angular-app/core/printing/receipt-print.service'
import {
  canVoidCashMovement,
  canCorrectCashSessionOpening,
} from '@angular-app/core/auth/role-policy'
import { computeCashTurnSummary } from '@angular-app/features/cash-register/domain/services/cash-closure'
import type { CashMovementType } from '@/shared/types'
import { SegmentedComponent } from '@angular-app/shared/molecules/segmented.component'
import { SkeletonComponent } from '@angular-app/shared/atoms/skeleton.component'
import { CashOpenSessionFormComponent } from '@angular-app/features/cash-register/presentation/components/cash-open-session-form.component'
import { OpenSessionFormPresenter } from '@angular-app/features/cash-register/presentation/presenters/open-session-form.presenter'
import { openSessionFormMapper } from '@angular-app/features/cash-register/presentation/forms/open-session-form.mapper'
import { CashTurnSummaryComponent } from '@angular-app/features/cash-register/presentation/components/cash-turn-summary.component'
import { CashMovementsTableComponent } from '@angular-app/features/cash-register/presentation/components/cash-movements-table.component'
import { cashMovementLabel } from '@angular-app/features/cash-register/presentation/services/cash-movement-labels'

@Component({
  selector: 'mo-caja-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [OpenSessionFormPresenter],
  imports: [
    RouterLink,
    PageHeaderComponent,
    CardComponent,
    ButtonComponent,
    EmptyStateComponent,
    SkeletonComponent,
    SegmentedComponent,
    CashOpenSessionFormComponent,
    CashTurnSummaryComponent,
    CashMovementsTableComponent,
    AddMovementDialog,
    CloseSessionDialog,
    CorrectOpeningDialog,
    CorrectMovementDialog,
    SaleDetailListComponent,
    VoidReasonDialog,
  ],
  template: `
    <section class="flex flex-col gap-4">
      <mo-page-header title="Caja" subtitle="Apertura, movimientos y cierre">
        @if (isAdmin()) {
          <a routerLink="/caja/historial" class="focus:ring-ring rounded-lg px-3 py-2 text-sm font-semibold underline underline-offset-4 focus:ring-2">Historial de cajas</a>
        }
        <mo-button
          variant="outline"
          [loading]="openingDrawer()"
          loadingText="Abriendo..."
          (click)="openCashDrawer()"
        >
          Abrir registradora
        </mo-button>
        @if (openSession()) {
          <mo-button
            variant="outline"
            [loading]="exporting()"
            loadingText="Generando..."
            (click)="exportTurn()"
          >
            Descargar Excel
          </mo-button>
          <mo-button variant="outline" (click)="openMovement()">+ Movimiento</mo-button>
          @if (canCorrectOpening()) {
            <mo-button variant="outline" (click)="correctOpeningOpen.set(true)">
              Corregir apertura
            </mo-button>
          }
          <mo-button variant="destructive" (click)="closeOpen.set(true)">Cerrar caja</mo-button>
        }
      </mo-page-header>

      @if (loading()) {
        <mo-skeleton heightClass="h-72" />
      } @else if (loadError()) {
        <mo-empty-state title="Error al cargar caja" [description]="loadError()">
          <mo-button (click)="load()">Reintentar</mo-button>
        </mo-empty-state>
      } @else if (!openSession()) {
        <mo-cash-open-session-form
          [form]="openForm.form"
          [suggestedAmount]="suggestedOpeningAmount()"
          [amountError]="openForm.errors().openingAmount ?? null"
          [error]="openForm.errors().root ?? null"
          [opening]="opening()"
          (submitted)="open()"
        />
      } @else {
        <mo-cash-turn-summary
          [session]="openSession()!"
          [summary]="cashTurnSummary()"
          [totalSales]="totalSales()"
          [paymentSummary]="primaryPaymentSummary()"
        />

        <mo-cash-movements-table
          [movements]="movements()"
          [canVoid]="canVoid()"
          (correct)="correctingMovement.set($event)"
          (voidRequested)="confirmVoidMovement($event)"
        />

        <mo-card padding="sm">
          <div class="flex flex-wrap items-center gap-2">
            <mo-segmented [options]="paymentMethodOptions" [(value)]="paymentFilter" />
            @if (paymentFilter()) {
              <button
                type="button"
                (click)="paymentFilter.set('')"
                class="text-muted-foreground hover:text-foreground text-xs underline"
              >
                Limpiar filtro
              </button>
            }
            <p class="text-muted-foreground ml-auto text-xs">
              {{ filteredSales().length }} de {{ sales().length }} ventas
            </p>
          </div>
        </mo-card>

        <mo-sale-detail-list
          [sales]="filteredSales()"
          [expandedSaleId]="expandedSaleId()"
          title="Ventas del turno"
          [emptyMessage]="salesEmptyMessage()"
          (toggleSale)="toggleSale($event)"
        />

      }

    </section>

    <mo-add-movement-dialog
      [open]="movementOpen()"
      [sessionId]="openSession()?.id ?? null"
      [initialType]="movementInitialType()"
      (closed)="movementOpen.set(false)"
      (saved)="reloadMovements()"
    />

    <mo-close-session-dialog
      [open]="closeOpen()"
      [cashSession]="openSession()"
      [expectedByMethod]="expectedByMethod()"
      [expectedCash]="expectedCashInDrawer()"
      (closed)="closeOpen.set(false)"
      (saved)="onClosed()"
    />

    <mo-correct-movement-dialog
      [open]="correctingMovement() !== null"
      [movement]="correctingMovement()"
      (closed)="correctingMovement.set(null)"
      (saved)="reloadMovements()"
    />

    <mo-correct-opening-dialog
      [open]="correctOpeningOpen()"
      [cashSession]="openSession()"
      (closed)="correctOpeningOpen.set(false)"
      (saved)="onOpeningCorrected($event)"
    />

    <mo-void-reason-dialog
      [open]="voidMovementDialogOpen()"
      title="Anular movimiento de caja"
      [targetLabel]="voidMovementTargetLabel()"
      placeholder="Describe por qué se anula este movimiento"
      (closed)="voidMovementDialogOpen.set(false)"
      (confirmed)="onVoidMovementConfirmed($event)"
    />
  `,
})
export class CajaPage {
  private readonly repo = inject(CashRegisterRepository)
  private readonly session = inject(SessionService)
  private readonly toast = inject(ToastService)
  private readonly salesRepo = inject(SaleRepository)
  private readonly excel = inject(ExcelExportService)
  private readonly receiptPrint = inject(ReceiptPrintService)

  readonly openSession = signal<CashSession | null>(null)
  readonly movements = signal<CashMovement[]>([])
  readonly breakdown = signal<PaymentBreakdown[]>([])
  readonly sales = signal<Sale[]>([])
  readonly loading = signal(true)
  readonly loadError = signal<string | null>(null)
  readonly opening = signal(false)
  readonly movementOpen = signal(false)
  readonly movementInitialType = signal<CashMovementType>('cash_in')
  readonly suggestedOpeningAmount = signal<number | null>(null)
  readonly closeOpen = signal(false)
  readonly correctOpeningOpen = signal(false)
  /** Movimiento del turno al que se le está corrigiendo monto/concepto (RN-C16). */
  readonly correctingMovement = signal<CashMovement | null>(null)
  readonly exporting = signal(false)
  readonly openingDrawer = signal(false)
  readonly paymentFilter = signal('')

  readonly paymentMethodOptions = PAYMENT_FILTER_OPTIONS

  readonly filteredSales = computed<Sale[]>(() => {
    const method = this.paymentFilter()
    if (!method) return this.sales()
    return this.sales().filter((s) => s.payments.some((p) => p.metodo === method))
  })

  /** Movimiento seleccionado para anular y visibilidad del dialog de motivo. */
  readonly voidMovementTarget = signal<CashMovement | null>(null)
  readonly voidMovementDialogOpen = signal(false)
  readonly voidMovementTargetLabel = computed(() => {
    const mov = this.voidMovementTarget()
    return mov ? `${cashMovementLabel(mov.tipo).toLowerCase()} de ${formatCurrency(mov.amount)}` : null
  })

  /** Solo admin puede anular movimientos de caja (defensa en cliente; RLS/RPC protegen en servidor). */
  readonly canVoid = computed(() => canVoidCashMovement(this.session.role()))

  /** Cualquier usuario activo de la tienda puede corregir la apertura (caja compartida, PLAN-44). */
  readonly canCorrectOpening = computed(() => canCorrectCashSessionOpening(this.session.role()))

  /** Solo admin ve el historial de turnos cerrados (supervisión, no operación del cajero). */
  readonly isAdmin = computed(() => this.session.isAdmin())

  /** Venta expandida en "Ventas del turno" (mo-sale-detail-list). */
  readonly expandedSaleId = signal<string | null>(null)

  readonly openForm = inject(OpenSessionFormPresenter)

  readonly cashTurnSummary = computed(() =>
    computeCashTurnSummary(
      this.openSession()?.openingAmount ?? 0,
      this.breakdown().find((payment) => payment.metodo === 'cash')?.total ?? 0,
      this.movements()
    )
  )
  readonly totalSales = computed(() => this.breakdown().reduce((sum, p) => sum + p.total, 0))
  readonly primaryPaymentSummary = computed<PaymentBreakdown[]>(() =>
    (['cash', 'transfer'] as const).map((metodo) => {
      const payment = this.breakdown().find((item) => item.metodo === metodo)
      return { metodo, count: payment?.count ?? 0, total: payment?.total ?? 0 }
    })
  )
  readonly expectedByMethod = computed<ExpectedByMethod[]>(() =>
    this.breakdown().map((p) => ({ metodo: p.metodo, total: p.total, count: p.count }))
  )
  readonly expectedCashInDrawer = computed(() => {
    return this.cashTurnSummary().expectedCashAmount
  })

  constructor() {
    void this.load()
  }

  salesEmptyMessage(): string {
    return this.paymentFilter()
      ? 'No hay ventas con ese método de pago.'
      : 'Sin ventas registradas.'
  }

  /** Abre el cajón físico vía QZ Tray; disponible con caja abierta o cerrada. */
  async openCashDrawer(): Promise<void> {
    if (this.openingDrawer()) return
    this.openingDrawer.set(true)
    try {
      await this.receiptPrint.openCashDrawer()
      this.toast.success('Registradora abierta')
    } catch (error) {
      this.toast.error(getErrorMessage(error, 'No se pudo abrir la registradora'))
    } finally {
      this.openingDrawer.set(false)
    }
  }

  async exportTurn(): Promise<void> {
    this.exporting.set(true)
    try {
      await this.excel.download(
        buildTurnSalesWorkbook(this.openSession(), this.sales(), this.movements())
      )
      this.toast.success('Turno descargado en Excel')
    } catch (error) {
      this.toast.error(getErrorMessage(error, 'No se pudo generar el archivo'))
    } finally {
      this.exporting.set(false)
    }
  }

  openMovement(tipo: CashMovementType = 'cash_in'): void {
    this.movementInitialType.set(tipo)
    this.movementOpen.set(true)
  }

  async load(): Promise<void> {
    this.loading.set(true)
    this.loadError.set(null)
    this.paymentFilter.set('')
    try {
      const auth = await this.session.getAuthContext()
      if (!auth) throw new Error('No autenticado')

      const session = await this.repo.getOpenSession(auth.tiendaId)
      this.openSession.set(session)
      if (!session) {
        const suggestedOpeningAmount = await this.repo.getSuggestedOpeningAmount(auth.tiendaId)
        this.suggestedOpeningAmount.set(suggestedOpeningAmount)
        this.openForm.reset(openSessionFormMapper.toFormValue(suggestedOpeningAmount))
        this.movements.set([])
        this.breakdown.set([])
        this.sales.set([])
      } else {
        this.suggestedOpeningAmount.set(null)
        const [movements, breakdown, sales] = await Promise.all([
          this.repo.listMovements(session.id),
          this.repo.getPaymentBreakdown(session.id, auth.tiendaId),
          this.salesRepo.listBySession(session.id, auth.tiendaId),
        ])
        this.movements.set(movements)
        this.breakdown.set(breakdown)
        this.sales.set(sales)
      }
    } catch (error) {
      this.loadError.set(getErrorMessage(error, 'Error al cargar caja'))
    } finally {
      this.loading.set(false)
    }
  }

  async open(): Promise<void> {
    if (this.opening()) return
    const value = this.openForm.validate()
    if (!value) return

    const auth = await this.session.getAuthContext()
    if (!auth) {
      this.openForm.setRootError('Sesion expirada')
      return
    }

    this.opening.set(true)
    try {
      const result = await openCashSession(
        { repo: this.repo, tiendaId: auth.tiendaId, openedBy: auth.userId },
        openSessionFormMapper.toPayload(value),
      )
      if (!result.ok) {
        this.openForm.setRootError(result.error.message)
        return
      }
      this.toast.success('Caja abierta')
      await this.load()
    } catch (error) {
      this.openForm.setRootError(getErrorMessage(error, 'No se pudo abrir caja'))
    } finally {
      this.opening.set(false)
    }
  }

  async reloadMovements(): Promise<void> {
    const session = this.openSession()
    if (!session) return
    const auth = await this.session.getAuthContext()
    if (!auth) return
    const [movements, breakdown, sales] = await Promise.all([
      this.repo.listMovements(session.id),
      this.repo.getPaymentBreakdown(session.id, auth.tiendaId),
      this.salesRepo.listBySession(session.id, auth.tiendaId),
    ])
    this.movements.set(movements)
    this.breakdown.set(breakdown)
    this.sales.set(sales)
  }

  onClosed(): void {
    void this.load()
  }

  toggleSale(sale: Sale): void {
    this.expandedSaleId.set(this.expandedSaleId() === sale.id ? null : sale.id)
  }

  onOpeningCorrected(session: CashSession): void {
    // Actualiza la tarjeta de apertura de inmediato sin recargar toda la página;
    // el nuevo opening_amount también recalcula "Esperado en caja" (computed).
    this.openSession.set(session)
  }

  confirmVoidMovement(mov: CashMovement): void {
    // Defensa en profundidad: cortocircuitar si el rol no puede anular ANTES de abrir.
    if (!this.canVoid()) return
    this.voidMovementTarget.set(mov)
    this.voidMovementDialogOpen.set(true)
  }

  async onVoidMovementConfirmed(reason: string): Promise<void> {
    // Defensa en profundidad: re-verificar el rol antes de ejecutar la anulación.
    if (!this.canVoid()) return
    const mov = this.voidMovementTarget()
    if (!mov) return

    const auth = await this.session.getAuthContext()
    if (!auth) return

    try {
      const result = await voidCashMovement(
        { repo: this.repo, tiendaId: auth.tiendaId, voidedBy: auth.userId },
        { movementId: mov.id, reason }
      )
      if (!result.ok) {
        this.toast.error(result.error.message)
        return
      }
      this.toast.success('Movimiento anulado')
      this.voidMovementTarget.set(null)
      await this.reloadMovements()
    } catch (error) {
      this.toast.error(getErrorMessage(error, 'No se pudo anular el movimiento'))
    }
  }
}
