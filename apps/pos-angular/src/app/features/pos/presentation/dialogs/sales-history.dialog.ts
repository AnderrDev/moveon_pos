import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core'
import { getErrorMessage } from '@/shared/lib/error-message'
import { DialogComponent } from '@angular-app/shared/organisms/dialog.component'
import { ButtonComponent } from '@angular-app/shared/atoms/button.component'
import { BadgeComponent } from '@angular-app/shared/atoms/badge.component'
import { SaleRepository } from '@angular-app/features/sales/domain/repositories/sale.repository'
import { voidSale } from '@angular-app/features/sales/domain/usecases/void-sale.use-case'
import { correctPayment } from '@angular-app/features/sales/domain/usecases/correct-payment.use-case'
import { correctSaleCustomer } from '@angular-app/features/sales/domain/usecases/correct-sale-customer.use-case'
import { SessionService } from '@angular-app/core/auth/session.service'
import {
  canVoidSale,
  canCorrectPayment,
  canCorrectSaleCustomer,
} from '@angular-app/core/auth/role-policy'
import { ToastService } from '@angular-app/shared/organisms/toast/toast.service'
import { ReceiptPrintService } from '@angular-app/core/printing/receipt-print.service'
import { VoidReasonDialog } from '@angular-app/shared/organisms/void-reason/void-reason.dialog'
import { CorrectPaymentDialog } from '@angular-app/features/pos/presentation/dialogs/correct-payment.dialog'
import { CustomerPickerDialog } from '@angular-app/features/pos/presentation/dialogs/customer-picker.dialog'
import { CorrectSaleCustomerDialog } from '@angular-app/features/pos/presentation/dialogs/correct-sale-customer.dialog'
import type { Cliente } from '@angular-app/features/customers/domain/entities/cliente.entity'
import { selectSessionSales } from '@angular-app/features/pos/presentation/services/sales-history-session-filter'
import { formatShortDate, formatTime } from '@/shared/lib/format'
import { PAYMENT_FILTER_OPTIONS, getPaymentMethodLabel } from '@/shared/lib/payment-methods'
import type { Sale } from '@angular-app/features/sales/domain/entities/sale.entity'
import type { PaymentMethod } from '@/shared/types'
import type { CashMovement } from '@angular-app/features/cash-register/domain/entities/cash-session.entity'
import { CashRegisterRepository } from '@angular-app/features/cash-register/domain/repositories/cash-register.repository'
import { ExcelExportService } from '@angular-app/shared/services/export/excel-export.service'
import { buildTurnSalesWorkbook } from '@angular-app/shared/services/export/turn-sales-export'
import { MoneyPipe } from '@angular-app/shared/pipes/money.pipe'
import { SaleDetailBodyComponent } from '@angular-app/shared/organisms/sale-detail-body.component'
import { SegmentedComponent } from '@angular-app/shared/molecules/segmented.component'
import { SkeletonComponent } from '@angular-app/shared/atoms/skeleton.component'
import { ChevronDown, FileText, LucideAngularModule } from 'lucide-angular'

@Component({
  selector: 'mo-sales-history-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, SkeletonComponent, SegmentedComponent, SaleDetailBodyComponent, MoneyPipe, 
    DialogComponent,
    ButtonComponent,
    BadgeComponent,
    VoidReasonDialog,
    CorrectPaymentDialog,
    CustomerPickerDialog,
    CorrectSaleCustomerDialog,
  ],
  template: `
    <mo-dialog
      [open]="open()"
      title="Ventas del turno"
      description="Historial detallado de las ventas registradas en la caja actual"
      width="xl"
      (closed)="closed.emit()"
    >
      @if (loading()) {
        <div class="space-y-3" aria-label="Cargando ventas">
          <mo-skeleton heightClass="h-20" />
          <mo-skeleton heightClass="h-28" />
          <mo-skeleton heightClass="h-28" />
        </div>
      } @else if (loadError()) {
        <div
          class="border-destructive/25 bg-destructive/5 rounded-2xl border px-5 py-8 text-center"
        >
          <p class="text-destructive font-semibold">No pudimos cargar el historial</p>
          <p class="text-muted-foreground mt-1 text-sm">{{ loadError() }}</p>
          <mo-button class="mt-4" variant="outline" size="sm" (click)="load()">
            Intentar de nuevo
          </mo-button>
        </div>
      } @else if (sales().length === 0) {
        <div
          class="border-border bg-muted/20 rounded-2xl border border-dashed px-5 py-12 text-center"
        >
          <div
            class="bg-primary/10 text-foreground mx-auto flex h-12 w-12 items-center justify-center rounded-2xl"
          >
            <lucide-angular [img]="icons.fileText" class="h-6 w-6" [strokeWidth]="1.8" aria-hidden="true" />
          </div>
          <p class="mt-4 font-bold">Aún no hay ventas en este turno</p>
          <p class="text-muted-foreground mt-1 text-sm">
            Las ventas aparecerán aquí con sus productos, pagos y responsable.
          </p>
        </div>
      } @else {
        <div class="mb-4 flex justify-end">
          <mo-button
            size="sm"
            variant="outline"
            [loading]="exporting()"
            loadingText="Generando..."
            (click)="exportTurn()"
          >
            Descargar Excel
          </mo-button>
        </div>
        <div class="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          <div
            class="border-primary/20 bg-primary/5 col-span-2 rounded-2xl border p-3.5 sm:col-span-1"
          >
            <p class="text-foreground text-xs font-bold">Total vendido</p>
            <p class="font-display text-foreground mt-1 text-xl font-black tabular-nums">
              {{ (completedSalesTotal() | money) }}
            </p>
          </div>
          <div class="border-border bg-card rounded-2xl border p-3.5">
            <p class="text-muted-foreground text-xs font-bold">
              Ventas efectivas
            </p>
            <p class="font-display mt-1 text-xl font-black tabular-nums">
              {{ completedSalesCount() }}
            </p>
          </div>
          <div class="border-border bg-card rounded-2xl border p-3.5">
            <p class="text-muted-foreground text-xs font-bold">
              Anuladas
            </p>
            <p class="font-display mt-1 text-xl font-black tabular-nums">
              {{ voidedSalesCount() }}
            </p>
          </div>
        </div>

        <div class="mb-4 flex flex-wrap items-center gap-2">
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

        @if (filteredSales().length === 0) {
          <div
            class="border-border bg-muted/20 rounded-2xl border border-dashed px-5 py-12 text-center"
          >
            <p class="font-bold">Sin ventas con ese método de pago</p>
            <p class="text-muted-foreground mt-1 text-sm">
              Prueba con otro filtro o límpialo para ver todas las ventas del turno.
            </p>
          </div>
        }

        <div class="space-y-3">
          @for (sale of filteredSales(); track sale.id) {
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
                      {{ date(sale.createdAt) }} · {{ time(sale.createdAt) }}
                    </p>
                  </div>
                  <div class="flex shrink-0 items-center gap-3">
                    <div class="text-right">
                      <p
                        class="text-muted-foreground text-xs font-bold"
                      >
                        Total
                      </p>
                      <p
                        class="font-display text-foreground mt-0.5 text-lg font-black tabular-nums"
                        [class.text-muted-foreground]="sale.status === 'voided'"
                        [class.line-through]="sale.status === 'voided'"
                      >
                        {{ (sale.total | money) }}
                      </p>
                    </div>
                    <span class="inline-flex shrink-0 transition-transform duration-200" [class.rotate-180]="isExpanded(sale)"><lucide-angular [img]="icons.chevronDown" class="text-muted-foreground h-5 w-5" aria-hidden="true" /></span>
                  </div>
                </div>

                <div class="mt-4 grid gap-2 text-xs sm:grid-cols-3">
                  <div class="bg-muted/50 min-w-0 rounded-xl px-3 py-2.5">
                    <p class="text-muted-foreground text-xs font-bold">Usuario</p>
                    <p class="mt-0.5 truncate font-semibold">{{ cashierLabel(sale) }}</p>
                  </div>
                  <div class="bg-muted/50 rounded-xl px-3 py-2.5">
                    <p class="text-muted-foreground text-xs font-bold">Productos</p>
                    <p class="mt-0.5 font-semibold tabular-nums">
                      {{ itemCount(sale) }} unidades · {{ sale.items.length }} referencias
                    </p>
                  </div>
                  <div class="bg-muted/50 min-w-0 rounded-xl px-3 py-2.5">
                    <p class="text-muted-foreground text-xs font-bold">Pago</p>
                    <p class="mt-0.5 truncate font-semibold">{{ paymentMethods(sale) }}</p>
                  </div>
                </div>
              </button>

              @if (isExpanded(sale)) {
                <div
                  [id]="'sale-detail-' + sale.id"
                  class="border-border bg-muted/20 border-t p-4 sm:p-5"
                >
                  <mo-sale-detail-body
                    [sale]="sale"
                    [canCorrectPayment]="canCorrectPaymentComputed() && cashSessionIsOpen()"
                    (correctPayment)="openCorrectPayment(sale, $event.paymentId, $event.metodo)"
                  />

                  <div class="border-border mt-4 flex flex-wrap justify-end gap-2 border-t pt-4">
                    <mo-button
                      size="sm"
                      variant="outline"
                      [loading]="reprintingSaleId() === sale.id"
                      [disabled]="reprintingSaleId() !== null"
                      loadingText="Enviando..."
                      (click)="reprint(sale)"
                    >
                      Reimprimir tirilla
                    </mo-button>
                    @if (
                      sale.status === 'completed' &&
                      !sale.clienteId &&
                      canCorrectSaleCustomerComputed()
                    ) {
                      <mo-button size="sm" variant="outline" (click)="openAssociateCustomer(sale)">
                        Asociar cliente
                      </mo-button>
                    }
                    @if (sale.status === 'completed' && canVoid()) {
                      <mo-button size="sm" variant="destructive" (click)="confirmVoid(sale)">
                        Anular venta
                      </mo-button>
                    }
                  </div>
                </div>
              }
            </article>
          }
        </div>
      }
    </mo-dialog>

    <mo-void-reason-dialog
      [open]="voidDialogOpen()"
      title="Anular venta"
      [targetLabel]="voidTargetLabel()"
      placeholder="Describe por qué se anula esta venta"
      (closed)="voidDialogOpen.set(false)"
      (confirmed)="onVoidConfirmed($event)"
    />

    <mo-correct-payment-dialog
      [open]="correctPaymentDialogOpen()"
      [paymentId]="correctPaymentTarget()?.paymentId ?? null"
      [currentMetodo]="correctPaymentTarget()?.currentMetodo ?? null"
      [saleNumber]="correctPaymentTarget()?.saleNumber ?? null"
      (closed)="correctPaymentDialogOpen.set(false)"
      (confirmed)="onCorrectPaymentConfirmed($event)"
    />

    <mo-customer-picker-dialog
      [open]="customerPickerOpen()"
      (closed)="customerPickerOpen.set(false)"
      (selected)="onCustomerPicked($event)"
      (createRequested)="onCustomerCreateRequested()"
    />

    <mo-correct-sale-customer-dialog
      [open]="correctCustomerDialogOpen()"
      [saleNumber]="correctCustomerTarget()?.sale?.saleNumber ?? null"
      [clienteNombre]="correctCustomerTarget()?.cliente?.nombre ?? null"
      (closed)="correctCustomerDialogOpen.set(false)"
      (confirmed)="onCorrectCustomerConfirmed($event)"
    />
  `,
})
export class SalesHistoryDialog {
  readonly icons = { chevronDown: ChevronDown, fileText: FileText }

  private readonly salesRepo = inject(SaleRepository)
  private readonly session = inject(SessionService)
  private readonly toast = inject(ToastService)
  private readonly receiptPrint = inject(ReceiptPrintService)
  private readonly cashRepo = inject(CashRegisterRepository)
  private readonly excel = inject(ExcelExportService)

  readonly open = input<boolean>(false)
  readonly cashSessionId = input<string | null>(null)
  readonly cashSessionIsOpen = input<boolean>(false)
  readonly closed = output<void>()
  readonly changed = output<void>()

  readonly sales = signal<Sale[]>([])
  readonly cashMovements = signal<CashMovement[]>([])
  readonly loading = signal(false)
  readonly loadError = signal<string | null>(null)
  readonly reprintingSaleId = signal<string | null>(null)
  readonly expandedSaleId = signal<string | null>(null)
  readonly exporting = signal(false)
  readonly paymentFilter = signal('')

  readonly paymentMethodOptions = PAYMENT_FILTER_OPTIONS

  readonly filteredSales = computed<Sale[]>(() => {
    const method = this.paymentFilter()
    if (!method) return this.sales()
    return this.sales().filter((s) => s.payments.some((p) => p.metodo === method))
  })

  /** Venta seleccionada para anular y visibilidad del dialog de motivo. */
  readonly voidTarget = signal<Sale | null>(null)
  readonly voidDialogOpen = signal(false)
  readonly voidTargetLabel = computed(() => {
    const number = this.voidTarget()?.saleNumber
    return number ? `la venta ${number}` : null
  })

  /** Solo admin puede anular ventas (defensa en cliente; RLS protege en servidor). */
  readonly canVoid = computed(() => canVoidSale(this.session.role()))

  /** Cualquier usuario autenticado puede corregir métodos de pago (defensa en cliente; RPC protege en servidor). */
  readonly canCorrectPaymentComputed = computed(() => canCorrectPayment(this.session.role()))

  /** Pago seleccionado para corrección y visibilidad del dialog de corrección. */
  readonly correctPaymentTarget = signal<{
    paymentId: string
    currentMetodo: PaymentMethod
    saleNumber: string
  } | null>(null)
  readonly correctPaymentDialogOpen = signal(false)

  /** Solo admin puede asociar retroactivamente un cliente (defensa en cliente; RLS protege en servidor). */
  readonly canCorrectSaleCustomerComputed = computed(() =>
    canCorrectSaleCustomer(this.session.role())
  )

  /** Venta pendiente de asociar cliente + selector de cliente + dialog de motivo. */
  readonly customerPickerOpen = signal(false)
  readonly correctCustomerTarget = signal<{ sale: Sale; cliente: Cliente } | null>(null)
  readonly correctCustomerDialogOpen = signal(false)
  private pendingSaleForCustomer: Sale | null = null

  constructor() {
    // Asegura que el rol esté cargado para la visibilidad reactiva del botón (OnPush).
    void this.session.getRole()
    effect(() => {
      // Blindaje: cerrar la caja (o cerrar el dialog) limpia el estado para que al
      // reabrir sin sesión arranque vacío — sin un frame con ventas viejas.
      // Patrón seguro: si no hay sesión/no está abierto -> reset + return; nunca
      // se leen señales escritas aquí, así que no hay bucle de effect.
      if (!this.open() || !this.cashSessionId()) {
        this.sales.set([])
        this.cashMovements.set([])
        this.loadError.set(null)
        this.expandedSaleId.set(null)
        this.paymentFilter.set('')
        // No dejar el dialog de motivo colgado si se cierra el historial.
        this.voidDialogOpen.set(false)
        this.voidTarget.set(null)
        // No dejar el dialog de corrección colgado si se cierra el historial.
        this.correctPaymentDialogOpen.set(false)
        this.correctPaymentTarget.set(null)
        // No dejar el flujo de asociar cliente colgado si se cierra el historial.
        this.customerPickerOpen.set(false)
        this.correctCustomerDialogOpen.set(false)
        this.correctCustomerTarget.set(null)
        this.pendingSaleForCustomer = null
        return
      }
      void this.load()
    })
  }

  time(d: Date): string {
    return formatTime(d)
  }

  date(d: Date): string {
    return formatShortDate(d)
  }

  completedSalesCount(): number {
    return this.sales().filter((sale) => sale.status === 'completed').length
  }

  completedSalesTotal(): number {
    return this.sales()
      .filter((sale) => sale.status === 'completed')
      .reduce((sum, sale) => sum + sale.total, 0)
  }

  voidedSalesCount(): number {
    return this.sales().filter((sale) => sale.status === 'voided').length
  }

  itemCount(sale: Sale): number {
    return sale.items.reduce((acc, i) => acc + i.quantity, 0)
  }

  paymentMethods(sale: Sale): string {
    const methods = [
      ...new Set(sale.payments.map((payment) => getPaymentMethodLabel(payment.metodo))),
    ]
    return methods.join(' + ') || 'Sin pago registrado'
  }


  cashierLabel(sale: Sale): string {
    return sale.cashierEmail || `Usuario ${sale.cashierId.slice(0, 8)}`
  }

  isExpanded(sale: Sale): boolean {
    return this.expandedSaleId() === sale.id
  }

  toggleSale(sale: Sale): void {
    this.expandedSaleId.update((current) => (current === sale.id ? null : sale.id))
  }

  async exportTurn(): Promise<void> {
    this.exporting.set(true)
    try {
      await this.excel.download(buildTurnSalesWorkbook(null, this.sales(), this.cashMovements()))
      this.toast.success('Ventas del turno descargadas')
    } catch (error) {
      this.toast.error(getErrorMessage(error, 'No se pudo generar el archivo'))
    } finally {
      this.exporting.set(false)
    }
  }

  async load(): Promise<void> {
    const sid = this.cashSessionId()
    if (!sid) return
    this.loading.set(true)
    this.loadError.set(null)
    try {
      const auth = await this.session.getAuthContext()
      if (!auth) throw new Error('No autenticado')
      const [rows, cashMovements] = await Promise.all([
        this.salesRepo.listBySession(sid, auth.tiendaId),
        this.cashRepo.listMovements(sid),
      ])
      // Segunda barrera pura sobre lo que devuelve el repo.
      const sessionSales = selectSessionSales(rows, sid)
      this.sales.set(sessionSales)
      this.cashMovements.set(cashMovements)
      if (!sessionSales.some((sale) => sale.id === this.expandedSaleId())) {
        this.expandedSaleId.set(sessionSales[0]?.id ?? null)
      }
    } catch (error) {
      this.loadError.set(getErrorMessage(error, 'Error al cargar'))
    } finally {
      this.loading.set(false)
    }
  }

  async reprint(sale: Sale): Promise<void> {
    if (this.reprintingSaleId() !== null) return
    this.reprintingSaleId.set(sale.id)
    try {
      await this.receiptPrint.printSale(sale.id)
      this.toast.success(`Tirilla ${sale.saleNumber} enviada`)
    } catch (error) {
      this.toast.error(getErrorMessage(error, 'No se pudo imprimir el ticket'))
    } finally {
      this.reprintingSaleId.set(null)
    }
  }

  async confirmVoid(sale: Sale): Promise<void> {
    // Defensa en profundidad: cortocircuitar si el rol no puede anular ANTES de abrir.
    if (!canVoidSale(await this.session.getRole())) return

    this.voidTarget.set(sale)
    this.voidDialogOpen.set(true)
  }

  async onVoidConfirmed(reason: string): Promise<void> {
    // Defensa en profundidad: re-verificar el rol antes de ejecutar la anulación.
    if (!canVoidSale(await this.session.getRole())) return

    const sale = this.voidTarget()
    if (!sale) return

    const auth = await this.session.getAuthContext()
    if (!auth) return

    try {
      const result = await voidSale(
        { repo: this.salesRepo, tiendaId: auth.tiendaId },
        { saleId: sale.id, voidedReason: reason }
      )
      if (!result.ok) {
        this.toast.error(result.error.message)
        return
      }
      this.toast.success(`Venta ${sale.saleNumber} anulada`)
      await this.load()
      this.changed.emit()
    } catch (error) {
      this.toast.error(getErrorMessage(error, 'No se pudo anular'))
    }
  }

  openCorrectPayment(sale: Sale, paymentId: string, currentMetodo: PaymentMethod): void {
    // Defensa en profundidad: cortocircuitar si el rol no puede corregir ANTES de abrir.
    if (!canCorrectPayment(this.session.role())) return

    this.correctPaymentTarget.set({
      paymentId,
      currentMetodo,
      saleNumber: sale.saleNumber,
    })
    this.correctPaymentDialogOpen.set(true)
  }

  async onCorrectPaymentConfirmed(event: {
    paymentId: string
    newMetodo: PaymentMethod
    reason: string
  }): Promise<void> {
    // Defensa en profundidad: re-verificar el rol antes de ejecutar la corrección.
    if (!canCorrectPayment(await this.session.getRole())) return

    const auth = await this.session.getAuthContext()
    if (!auth) return

    try {
      const result = await correctPayment(
        { repo: this.salesRepo, tiendaId: auth.tiendaId },
        { paymentId: event.paymentId, newMetodo: event.newMetodo, reason: event.reason }
      )
      if (!result.ok) {
        this.toast.error(result.error.message)
        return
      }
      this.toast.success('Método de pago corregido')
      await this.load()
      this.changed.emit()
    } catch (error) {
      this.toast.error(getErrorMessage(error, 'No se pudo corregir el pago'))
    }
  }

  openAssociateCustomer(sale: Sale): void {
    // Defensa en profundidad: cortocircuitar si el rol no puede corregir ANTES de abrir.
    if (!canCorrectSaleCustomer(this.session.role())) return

    this.pendingSaleForCustomer = sale
    this.customerPickerOpen.set(true)
  }

  onCustomerPicked(cliente: Cliente): void {
    const sale = this.pendingSaleForCustomer
    if (!sale) return
    this.correctCustomerTarget.set({ sale, cliente })
    this.correctCustomerDialogOpen.set(true)
  }

  onCustomerCreateRequested(): void {
    this.toast.info('Crea el cliente desde el módulo Clientes y vuelve a intentar')
  }

  async onCorrectCustomerConfirmed(reason: string): Promise<void> {
    // Defensa en profundidad: re-verificar el rol antes de ejecutar la corrección.
    if (!canCorrectSaleCustomer(await this.session.getRole())) return

    const target = this.correctCustomerTarget()
    if (!target) return

    const auth = await this.session.getAuthContext()
    if (!auth) return

    try {
      const result = await correctSaleCustomer(
        { repo: this.salesRepo, tiendaId: auth.tiendaId },
        { saleId: target.sale.id, clienteId: target.cliente.id, reason }
      )
      if (!result.ok) {
        this.toast.error(result.error.message)
        return
      }
      this.toast.success(
        `Cliente ${target.cliente.nombre} asociado a la venta ${target.sale.saleNumber}`
      )
      this.correctCustomerTarget.set(null)
      this.pendingSaleForCustomer = null
      await this.load()
      this.changed.emit()
    } catch (error) {
      this.toast.error(getErrorMessage(error, 'No se pudo asociar el cliente'))
    }
  }
}
