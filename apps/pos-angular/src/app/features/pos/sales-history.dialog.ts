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
import { DialogComponent } from '../../shared/ui/dialog.component'
import { ButtonComponent } from '../../shared/ui/button.component'
import { BadgeComponent } from '../../shared/ui/badge.component'
import { SalesRepository } from '../sales/sales.repository'
import { SessionService } from '../../core/auth/session.service'
import { canVoidSale } from '../../core/auth/role-policy'
import { ToastService } from '../../shared/feedback/toast.service'
import { ReceiptPrintService } from './receipt-print.service'
import { VoidReasonDialog } from './void-reason.dialog'
import { selectSessionSales } from './sales-history.session-filter'
import { formatCurrency, formatShortDate, formatTime } from '@/shared/lib/format'
import { getPaymentMethodLabel } from '@/shared/lib/payment-methods'
import type { Sale } from '@/modules/sales/domain/entities/sale.entity'
import type { CashMovement } from '@/modules/cash-register/domain/entities/cash-session.entity'
import { CashRegisterRepository } from '../cash-register/cash-register.repository'
import { ExcelExportService } from '../../shared/export/excel-export.service'
import { buildTurnSalesWorkbook } from './sales-export'

@Component({
  selector: 'mo-sales-history-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogComponent, ButtonComponent, BadgeComponent, VoidReasonDialog],
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
          <div class="bg-muted h-20 animate-pulse rounded-2xl"></div>
          <div class="bg-muted h-28 animate-pulse rounded-2xl"></div>
          <div class="bg-muted h-28 animate-pulse rounded-2xl"></div>
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
            class="bg-primary/10 text-primary mx-auto flex h-12 w-12 items-center justify-center rounded-2xl"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" class="h-6 w-6">
              <path d="M6 2h9l3 3v17H6z" stroke-width="1.8" />
              <path d="M9 9h6M9 13h6M9 17h4" stroke-width="1.8" />
            </svg>
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
            <p class="text-primary text-[10px] font-bold tracking-wide uppercase">Total vendido</p>
            <p class="font-display text-primary mt-1 text-xl font-black tabular-nums">
              {{ money(completedSalesTotal()) }}
            </p>
          </div>
          <div class="border-border bg-card rounded-2xl border p-3.5">
            <p class="text-muted-foreground text-[10px] font-bold tracking-wide uppercase">
              Ventas efectivas
            </p>
            <p class="font-display mt-1 text-xl font-black tabular-nums">
              {{ completedSalesCount() }}
            </p>
          </div>
          <div class="border-border bg-card rounded-2xl border p-3.5">
            <p class="text-muted-foreground text-[10px] font-bold tracking-wide uppercase">
              Anuladas
            </p>
            <p class="font-display mt-1 text-xl font-black tabular-nums">
              {{ voidedSalesCount() }}
            </p>
          </div>
        </div>

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
                        class="text-muted-foreground text-[10px] font-bold tracking-wide uppercase"
                      >
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
                    <p class="mt-0.5 truncate font-semibold">{{ cashierLabel(sale) }}</p>
                  </div>
                  <div class="bg-muted/50 rounded-xl px-3 py-2.5">
                    <p class="text-muted-foreground text-[10px] font-bold uppercase">Productos</p>
                    <p class="mt-0.5 font-semibold tabular-nums">
                      {{ itemCount(sale) }} unidades · {{ sale.items.length }} referencias
                    </p>
                  </div>
                  <div class="bg-muted/50 min-w-0 rounded-xl px-3 py-2.5">
                    <p class="text-muted-foreground text-[10px] font-bold uppercase">Pago</p>
                    <p class="mt-0.5 truncate font-semibold">{{ paymentMethods(sale) }}</p>
                  </div>
                </div>
              </button>

              @if (isExpanded(sale)) {
                <div
                  [id]="'sale-detail-' + sale.id"
                  class="border-border bg-muted/20 border-t p-4 sm:p-5"
                >
                  <div class="grid gap-4 md:grid-cols-[minmax(0,1.3fr)_minmax(16rem,0.7fr)]">
                    <section class="border-border bg-card overflow-hidden rounded-2xl border">
                      <div
                        class="border-border flex items-center justify-between border-b px-4 py-3"
                      >
                        <h3 class="text-sm font-black">Productos vendidos</h3>
                        <span class="text-muted-foreground text-xs"
                          >{{ sale.items.length }} líneas</span
                        >
                      </div>
                      <div class="divide-border divide-y">
                        @for (item of sale.items; track item.id) {
                          <div class="flex items-start gap-3 px-4 py-3.5">
                            <span
                              class="bg-primary/10 text-primary inline-flex h-8 min-w-8 shrink-0 items-center justify-center rounded-lg px-2 text-xs font-black tabular-nums"
                            >
                              {{ item.quantity }}×
                            </span>
                            <div class="min-w-0 flex-1">
                              <p class="text-sm leading-snug font-bold">
                                {{ item.productoNombre }}
                              </p>
                              <p class="text-muted-foreground mt-1 text-xs">
                                {{ money(item.unitPrice) }} c/u
                                @if (item.productoSku) {
                                  · SKU {{ item.productoSku }}
                                }
                              </p>
                              <div class="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
                                @if (item.discountAmount > 0) {
                                  <span class="text-emerald-700">
                                    Desc. producto −{{ money(itemDiscountTotal(item)) }}
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
                            <p class="shrink-0 text-sm font-black tabular-nums">
                              {{ money(item.total) }}
                            </p>
                          </div>
                        }
                      </div>
                    </section>

                    <div class="space-y-4">
                      <section class="border-border bg-card rounded-2xl border p-4">
                        <h3 class="text-sm font-black">Resumen de la venta</h3>
                        <dl class="mt-3 space-y-2 text-sm">
                          <div class="flex justify-between gap-3">
                            <dt class="text-muted-foreground">Subtotal</dt>
                            <dd class="font-semibold tabular-nums">{{ money(sale.subtotal) }}</dd>
                          </div>
                          <div class="flex justify-between gap-3">
                            <dt class="text-muted-foreground">Descuentos por producto</dt>
                            <dd class="font-semibold tabular-nums">
                              {{ sale.itemDiscountTotal > 0 ? '−' : ''
                              }}{{ money(sale.itemDiscountTotal) }}
                            </dd>
                          </div>
                          @if (sale.globalDiscountTotal > 0) {
                            <div class="flex justify-between gap-3">
                              <dt class="text-muted-foreground">Descuento global</dt>
                              <dd class="font-semibold tabular-nums">
                                −{{ money(sale.globalDiscountTotal) }}
                              </dd>
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
                            <dd class="text-primary text-lg font-black tabular-nums">
                              {{ money(sale.total) }}
                            </dd>
                          </div>
                        </dl>
                      </section>

                      <section class="border-border bg-card rounded-2xl border p-4">
                        <h3 class="text-sm font-black">Pagos recibidos</h3>
                        <div class="mt-3 space-y-2.5">
                          @for (payment of sale.payments; track payment.id) {
                            <div class="flex items-start justify-between gap-3 text-sm">
                              <div>
                                <p class="font-semibold">{{ paymentLabel(payment.metodo) }}</p>
                                @if (payment.referencia) {
                                  <p class="text-muted-foreground mt-0.5 text-[11px]">
                                    Ref. {{ payment.referencia }}
                                  </p>
                                }
                              </div>
                              <span class="font-bold tabular-nums">{{
                                money(payment.amount)
                              }}</span>
                            </div>
                          }
                        </div>
                        <dl class="border-border mt-3 space-y-2 border-t pt-3 text-sm">
                          <div class="flex justify-between gap-3">
                            <dt class="text-muted-foreground">Total recibido</dt>
                            <dd class="font-bold tabular-nums">{{ money(totalPaid(sale)) }}</dd>
                          </div>
                          <div class="flex justify-between gap-3">
                            <dt class="font-bold">Cambio entregado</dt>
                            <dd class="text-primary font-black tabular-nums">
                              {{ money(sale.change) }}
                            </dd>
                          </div>
                        </dl>
                      </section>

                      <section class="border-border bg-card rounded-2xl border p-4">
                        <h3 class="text-sm font-black">Registro</h3>
                        <dl class="mt-3 space-y-2 text-xs">
                          <div class="flex justify-between gap-3">
                            <dt class="text-muted-foreground">Usuario</dt>
                            <dd class="max-w-44 truncate text-right font-semibold">
                              {{ cashierLabel(sale) }}
                            </dd>
                          </div>
                          <div class="flex justify-between gap-3">
                            <dt class="text-muted-foreground">Cliente</dt>
                            <dd class="max-w-44 truncate text-right font-semibold">
                              {{ customerLabel(sale) }}
                            </dd>
                          </div>
                          <div class="flex justify-between gap-3">
                            <dt class="text-muted-foreground">Fecha y hora</dt>
                            <dd class="text-right font-semibold">
                              {{ date(sale.createdAt) }} · {{ time(sale.createdAt) }}
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
      [saleNumber]="voidTarget()?.saleNumber ?? null"
      (closed)="voidDialogOpen.set(false)"
      (confirmed)="onVoidConfirmed($event)"
    />
  `,
})
export class SalesHistoryDialog {
  private readonly salesRepo = inject(SalesRepository)
  private readonly session = inject(SessionService)
  private readonly toast = inject(ToastService)
  private readonly receiptPrint = inject(ReceiptPrintService)
  private readonly cashRepo = inject(CashRegisterRepository)
  private readonly excel = inject(ExcelExportService)

  readonly open = input<boolean>(false)
  readonly cashSessionId = input<string | null>(null)
  readonly closed = output<void>()
  readonly changed = output<void>()

  readonly sales = signal<Sale[]>([])
  readonly cashMovements = signal<CashMovement[]>([])
  readonly loading = signal(false)
  readonly loadError = signal<string | null>(null)
  readonly reprintingSaleId = signal<string | null>(null)
  readonly expandedSaleId = signal<string | null>(null)
  readonly exporting = signal(false)

  /** Venta seleccionada para anular y visibilidad del dialog de motivo. */
  readonly voidTarget = signal<Sale | null>(null)
  readonly voidDialogOpen = signal(false)

  /** Solo admin puede anular ventas (defensa en cliente; RLS protege en servidor). */
  readonly canVoid = computed(() => canVoidSale(this.session.role()))

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
        // No dejar el dialog de motivo colgado si se cierra el historial.
        this.voidDialogOpen.set(false)
        this.voidTarget.set(null)
        return
      }
      void this.load()
    })
  }

  money(v: number): string {
    return formatCurrency(v)
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

  paymentLabel(method: string): string {
    return getPaymentMethodLabel(method)
  }

  totalPaid(sale: Sale): number {
    return sale.payments.reduce((sum, payment) => sum + payment.amount, 0)
  }

  itemDiscountTotal(item: Sale['items'][number]): number {
    return item.discountAmount * item.quantity
  }

  cashierLabel(sale: Sale): string {
    return sale.cashierEmail || `Usuario ${sale.cashierId.slice(0, 8)}`
  }

  customerLabel(sale: Sale): string {
    return (
      sale.clienteNombre ||
      (sale.clienteId ? `Cliente ${sale.clienteId.slice(0, 8)}` : 'Consumidor final')
    )
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
      await this.excel.download(buildTurnSalesWorkbook(this.sales(), this.cashMovements()))
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
      await this.salesRepo.voidSale(sale.id, auth.tiendaId, reason)
      this.toast.success(`Venta ${sale.saleNumber} anulada`)
      await this.load()
      this.changed.emit()
    } catch (error) {
      this.toast.error(getErrorMessage(error, 'No se pudo anular'))
    }
  }
}
