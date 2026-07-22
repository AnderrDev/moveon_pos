import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core'
import { getErrorMessage } from '@/shared/lib/error-message'
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms'
import { PageHeaderComponent } from '@angular-app/shared/molecules/page-header.component'
import { CardComponent } from '@angular-app/shared/atoms/card.component'
import { ButtonComponent } from '@angular-app/shared/atoms/button.component'
import { BadgeComponent } from '@angular-app/shared/atoms/badge.component'
import { EmptyStateComponent } from '@angular-app/shared/molecules/empty-state.component'
import { FormCurrencyInputComponent } from '@angular-app/shared/molecules/form-currency-input.component'
import { FormErrorComponent } from '@angular-app/shared/molecules/form-error.component'
import { CashRegisterRepository } from '@angular-app/features/cash-register/domain/repositories/cash-register.repository'
import type { PaymentBreakdown } from '@angular-app/features/cash-register/domain/repositories/cash-register.repository'
import { openCashSession } from '@angular-app/features/cash-register/domain/usecases/open-session.use-case'
import { voidCashMovement } from '@angular-app/features/cash-register/domain/usecases/void-movement.use-case'
import { SessionService } from '@angular-app/core/auth/session.service'
import { ToastService } from '@angular-app/shared/organisms/toast/toast.service'
import { AddMovementDialog } from '@angular-app/features/cash-register/presentation/dialogs/add-movement.dialog'
import { CloseSessionDialog, type ExpectedByMethod } from '@angular-app/features/cash-register/presentation/dialogs/close-session.dialog'
import { CorrectOpeningDialog } from '@angular-app/features/cash-register/presentation/dialogs/correct-opening.dialog'
import { ClosedSessionsListComponent } from '@angular-app/features/cash-register/presentation/components/closed-sessions-list.component'
import { SaleDetailListComponent } from '@angular-app/shared/organisms/sale-detail-list.component'
import { formatCurrency, formatTime, formatShortDate } from '@/shared/lib/format'
import { PAYMENT_METHOD_CLOSURE_OPTIONS, getPaymentMethodLabel } from '@/shared/lib/payment-methods'
import type {
  CashMovement,
  CashSession,
} from '@angular-app/features/cash-register/domain/entities/cash-session.entity'
import type { Sale } from '@angular-app/features/sales/domain/entities/sale.entity'
import { SaleRepository } from '@angular-app/features/sales/domain/repositories/sale.repository'
import { ExcelExportService } from '@angular-app/shared/services/export/excel-export.service'
import { buildTurnSalesWorkbook } from '@angular-app/features/pos/presentation/services/sales-export'
import { VoidReasonDialog } from '@angular-app/shared/organisms/void-reason/void-reason.dialog'
import { ReceiptPrintService } from '@angular-app/features/pos/presentation/services/receipt-print.service'
import {
  canVoidCashMovement,
  canCorrectCashSessionOpening,
  canViewClosedSessions,
} from '@angular-app/core/auth/role-policy'

@Component({
  selector: 'mo-caja-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    PageHeaderComponent,
    CardComponent,
    ButtonComponent,
    BadgeComponent,
    EmptyStateComponent,
    FormCurrencyInputComponent,
    FormErrorComponent,
    AddMovementDialog,
    CloseSessionDialog,
    CorrectOpeningDialog,
    SaleDetailListComponent,
    ClosedSessionsListComponent,
    VoidReasonDialog,
  ],
  template: `
    <section class="flex flex-col gap-4">
      <mo-page-header title="Caja" subtitle="Apertura, movimientos y cierre">
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
          <mo-button variant="outline" (click)="movementOpen.set(true)">+ Movimiento</mo-button>
          @if (canCorrectOpening()) {
            <mo-button variant="outline" (click)="correctOpeningOpen.set(true)">
              Corregir apertura
            </mo-button>
          }
          <mo-button variant="destructive" (click)="closeOpen.set(true)">Cerrar caja</mo-button>
        }
      </mo-page-header>

      @if (loading()) {
        <div class="bg-card flex-1 animate-pulse rounded-xl border p-8">
          <div class="bg-muted/50 h-72 rounded-xl"></div>
        </div>
      } @else if (loadError()) {
        <mo-empty-state title="Error al cargar caja" [description]="loadError()">
          <mo-button (click)="load()">Reintentar</mo-button>
        </mo-empty-state>
      } @else if (!openSession()) {
        <div class="bg-card mx-auto w-full max-w-md rounded-xl border p-6">
          <h2 class="font-display text-lg font-bold">Abrir caja</h2>
          <p class="text-muted-foreground mt-1 text-sm">
            Captura el efectivo inicial con el que arrancas el turno.
          </p>

          <form [formGroup]="openForm" (ngSubmit)="open()" class="mt-4 space-y-4">
            <mo-form-currency-input
              controlName="openingAmount"
              label="Monto de apertura"
              [required]="true"
            />
            <mo-form-error [message]="openError()" />
            <mo-button type="submit" [loading]="opening()" loadingText="Abriendo..." class="w-full">
              Abrir caja
            </mo-button>
          </form>
        </div>
      } @else {
        <div class="grid gap-4 lg:grid-cols-3">
          <div class="bg-card rounded-xl border p-5 lg:col-span-2">
            <p class="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Caja abierta
            </p>
            <h2 class="font-display mt-1 text-2xl font-bold">
              {{ money(openSession()!.openingAmount) }}
            </h2>
            <p class="text-muted-foreground text-xs">
              {{ shortDate(openSession()!.openedAt) }} · {{ time(openSession()!.openedAt) }}
            </p>

            <div class="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div class="rounded-lg border px-3 py-2">
                <p class="text-muted-foreground text-[11px] font-semibold uppercase">
                  Total ventas
                </p>
                <p class="font-bold tabular-nums">{{ money(totalSales()) }}</p>
              </div>
              <div class="rounded-lg border px-3 py-2">
                <p class="text-muted-foreground text-[11px] font-semibold uppercase">Movimientos</p>
                <p class="font-bold tabular-nums">
                  {{ movementsTotal() >= 0 ? '+' : '' }}{{ money(movementsTotal()) }}
                </p>
              </div>
              <div class="rounded-lg border px-3 py-2">
                <p class="text-muted-foreground text-[11px] font-semibold uppercase">
                  Esperado en caja
                </p>
                <p class="font-bold tabular-nums">{{ money(expectedCashInDrawer()) }}</p>
              </div>
            </div>
          </div>

          <div class="bg-card rounded-xl border p-5">
            <p class="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Por metodo de pago
            </p>
            @if (breakdown().length === 0) {
              <p class="text-muted-foreground mt-3 text-sm">Aun no hay ventas registradas.</p>
            } @else {
              <ul class="mt-3 space-y-2 text-sm">
                @for (item of breakdown(); track item.metodo) {
                  <li class="flex items-center justify-between">
                    <span>{{ paymentLabel(item.metodo) }}</span>
                    <span class="font-mono font-semibold tabular-nums">
                      {{ money(item.total) }}
                    </span>
                  </li>
                }
              </ul>
            }
          </div>
        </div>

        <div class="bg-card flex flex-col overflow-hidden rounded-xl border">
          <div class="flex shrink-0 items-center justify-between border-b px-4 py-3">
            <h3 class="font-display text-sm font-bold tracking-wide uppercase">
              Movimientos del turno
            </h3>
            <mo-badge variant="default">{{ movements().length }}</mo-badge>
          </div>

          @if (movements().length === 0) {
            <p class="text-muted-foreground p-8 text-center text-sm">
              Sin movimientos registrados.
            </p>
          } @else {
            <div class="max-h-[28rem] overflow-auto">
              <table class="w-full text-sm">
                <thead
                  class="bg-muted/50 text-muted-foreground sticky top-0 text-left text-xs uppercase"
                >
                  <tr>
                    <th class="px-4 py-2">Hora</th>
                    <th class="px-4 py-2">Tipo</th>
                    <th class="px-4 py-2">Motivo</th>
                    <th class="px-4 py-2 text-right">Monto</th>
                    @if (canVoid()) {
                      <th class="px-4 py-2"></th>
                    }
                  </tr>
                </thead>
                <tbody class="divide-y">
                  @for (mov of movements(); track mov.id) {
                    <tr [class.opacity-50]="mov.status === 'voided'">
                      <td class="text-muted-foreground px-4 py-2 text-xs">
                        {{ time(mov.createdAt) }}
                      </td>
                      <td class="px-4 py-2">
                        <mo-badge [variant]="movBadge(mov)">{{ movLabel(mov.tipo) }}</mo-badge>
                        @if (mov.status === 'voided') {
                          <mo-badge variant="default" class="ml-1">Anulado</mo-badge>
                        }
                      </td>
                      <td class="text-muted-foreground px-4 py-2">
                        <span [class.line-through]="mov.status === 'voided'">{{ mov.motivo }}</span>
                        @if (mov.status === 'voided') {
                          <p class="text-destructive mt-0.5 text-xs">
                            Motivo de anulación: {{ mov.voidedReason || 'Sin motivo registrado' }}
                          </p>
                        }
                      </td>
                      <td
                        class="px-4 py-2 text-right font-semibold tabular-nums"
                        [class.line-through]="mov.status === 'voided'"
                        [class.text-emerald-600]="mov.tipo === 'cash_in' && mov.status === 'active'"
                        [class.text-destructive]="mov.tipo !== 'cash_in' && mov.status === 'active'"
                      >
                        {{ mov.tipo === 'cash_in' ? '+' : '−' }}{{ money(mov.amount) }}
                      </td>
                      @if (canVoid()) {
                        <td class="px-4 py-2 text-right">
                          @if (mov.status === 'active') {
                            <mo-button size="sm" variant="outline" (click)="confirmVoidMovement(mov)">
                              Anular
                            </mo-button>
                          }
                        </td>
                      }
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>

        <mo-card padding="sm">
          <div class="flex flex-wrap items-center gap-2">
            <div class="flex flex-wrap gap-1">
              @for (m of paymentMethodOptions; track m.value) {
                <button
                  type="button"
                  (click)="paymentFilter.set(m.value)"
                  [class]="paymentFilterClass(m.value)"
                >
                  {{ m.label }}
                </button>
              }
            </div>
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

        @if (canViewHistory()) {
          <mo-closed-sessions-list />
        }
      }
    </section>

    <mo-add-movement-dialog
      [open]="movementOpen()"
      [sessionId]="openSession()?.id ?? null"
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
  readonly openError = signal<string | null>(null)
  readonly opening = signal(false)
  readonly movementOpen = signal(false)
  readonly closeOpen = signal(false)
  readonly correctOpeningOpen = signal(false)
  readonly exporting = signal(false)
  readonly openingDrawer = signal(false)
  readonly paymentFilter = signal('')

  readonly paymentMethodOptions = [
    { value: '', label: 'Todos los métodos' },
    ...PAYMENT_METHOD_CLOSURE_OPTIONS,
  ]

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
    return mov ? `${this.movLabel(mov.tipo).toLowerCase()} de ${this.money(mov.amount)}` : null
  })

  /** Solo admin puede anular movimientos de caja (defensa en cliente; RLS/RPC protegen en servidor). */
  readonly canVoid = computed(() => canVoidCashMovement(this.session.role()))

  /** Cualquier usuario activo de la tienda puede corregir la apertura (caja compartida, PLAN-44). */
  readonly canCorrectOpening = computed(() => canCorrectCashSessionOpening(this.session.role()))

  /** Solo admin ve el historial de turnos cerrados (supervisión, no operación del cajero). */
  readonly canViewHistory = computed(() => canViewClosedSessions(this.session.role()))

  /** Venta expandida en "Ventas del turno" (mo-sale-detail-list). */
  readonly expandedSaleId = signal<string | null>(null)

  readonly openForm = new FormGroup({
    openingAmount: new FormControl<number>(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0)],
    }),
  })

  readonly movementsTotal = computed(() =>
    this.movements()
      .filter((m) => m.status === 'active')
      .reduce((sum, m) => sum + (m.tipo === 'cash_in' ? m.amount : -m.amount), 0)
  )
  readonly totalSales = computed(() => this.breakdown().reduce((sum, p) => sum + p.total, 0))
  readonly expectedByMethod = computed<ExpectedByMethod[]>(() =>
    this.breakdown().map((p) => ({ metodo: p.metodo, total: p.total, count: p.count }))
  )
  readonly expectedCashInDrawer = computed(() => {
    const opening = this.openSession()?.openingAmount ?? 0
    const cashSales = this.breakdown().find((p) => p.metodo === 'cash')?.total ?? 0
    return opening + cashSales + this.movementsTotal()
  })

  constructor() {
    void this.load()
  }

  money(v: number): string {
    return formatCurrency(v)
  }

  time(d: Date): string {
    return formatTime(d)
  }

  shortDate(d: Date): string {
    return formatShortDate(d)
  }

  paymentLabel(metodo: string): string {
    return getPaymentMethodLabel(metodo)
  }

  paymentFilterClass(value: string): string {
    return [
      'rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors',
      this.paymentFilter() === value
        ? 'bg-secondary text-secondary-foreground'
        : 'hover:bg-muted text-muted-foreground',
    ].join(' ')
  }

  salesEmptyMessage(): string {
    return this.paymentFilter() ? 'No hay ventas con ese método de pago.' : 'Sin ventas registradas.'
  }

  movLabel(tipo: string): string {
    if (tipo === 'cash_in') return 'Entrada'
    if (tipo === 'cash_out') return 'Salida'
    if (tipo === 'expense') return 'Gasto'
    if (tipo === 'correction') return 'Correccion'
    return tipo
  }

  movBadge(mov: CashMovement): 'success' | 'warning' | 'destructive' | 'default' {
    if (mov.tipo === 'cash_in') return 'success'
    if (mov.tipo === 'cash_out') return 'warning'
    if (mov.tipo === 'expense') return 'destructive'
    return 'default'
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
      await this.excel.download(buildTurnSalesWorkbook(this.sales(), this.movements()))
      this.toast.success('Turno descargado en Excel')
    } catch (error) {
      this.toast.error(getErrorMessage(error, 'No se pudo generar el archivo'))
    } finally {
      this.exporting.set(false)
    }
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
        this.movements.set([])
        this.breakdown.set([])
        this.sales.set([])
      } else {
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
    this.openForm.markAllAsTouched()
    if (this.openForm.invalid) return
    this.openError.set(null)

    const auth = await this.session.getAuthContext()
    if (!auth) {
      this.openError.set('Sesion expirada')
      return
    }

    this.opening.set(true)
    try {
      const result = await openCashSession(
        { repo: this.repo, tiendaId: auth.tiendaId, openedBy: auth.userId },
        { openingAmount: this.openForm.value.openingAmount ?? 0 },
      )
      if (!result.ok) {
        this.openError.set(result.error.message)
        return
      }
      this.toast.success('Caja abierta')
      await this.load()
    } catch (error) {
      this.openError.set(getErrorMessage(error, 'No se pudo abrir caja'))
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
        { movementId: mov.id, reason },
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
