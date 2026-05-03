import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core'
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms'
import { PageHeaderComponent } from '../../shared/layout/page-header.component'
import { ButtonComponent } from '../../shared/ui/button.component'
import { BadgeComponent } from '../../shared/ui/badge.component'
import { EmptyStateComponent } from '../../shared/feedback/empty-state.component'
import { FormCurrencyInputComponent } from '../../shared/forms/form-currency-input.component'
import { FormErrorComponent } from '../../shared/forms/form-error.component'
import { CashRegisterRepository, type PaymentBreakdown } from './cash-register.repository'
import { SessionService } from '../../core/auth/session.service'
import { ToastService } from '../../shared/feedback/toast.service'
import { AddMovementDialog } from './add-movement.dialog'
import { CloseSessionDialog } from './close-session.dialog'
import { formatCurrency, formatTime, formatShortDate } from '@/shared/lib/format'
import { getPaymentMethodLabel } from '@/shared/lib/payment-methods'
import type {
  CashMovement,
  CashSession,
} from '@/modules/cash-register/domain/entities/cash-session.entity'

@Component({
  selector: 'mo-caja-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    PageHeaderComponent,
    ButtonComponent,
    BadgeComponent,
    EmptyStateComponent,
    FormCurrencyInputComponent,
    FormErrorComponent,
    AddMovementDialog,
    CloseSessionDialog,
  ],
  template: `
    <section class="flex h-full min-h-0 flex-col gap-4">
      <mo-page-header title="Caja" subtitle="Apertura, movimientos y cierre">
        @if (openSession()) {
          <mo-button variant="outline" (click)="movementOpen.set(true)">+ Movimiento</mo-button>
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
            <mo-button
              type="submit"
              [loading]="opening()"
              loadingText="Abriendo..."
              class="w-full"
            >
              Abrir caja
            </mo-button>
          </form>
        </div>
      } @else {
        <div class="grid gap-4 lg:grid-cols-3">
          <div class="bg-card rounded-xl border p-5 lg:col-span-2">
            <p class="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
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
                <p class="font-bold tabular-nums">{{ movementsTotal() >= 0 ? '+' : '' }}{{ money(movementsTotal()) }}</p>
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
            <p class="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
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

        <div class="bg-card flex flex-1 flex-col overflow-hidden rounded-xl border">
          <div class="flex shrink-0 items-center justify-between border-b px-4 py-3">
            <h3 class="font-display text-sm font-bold uppercase tracking-wide">
              Movimientos del turno
            </h3>
            <mo-badge variant="default">{{ movements().length }}</mo-badge>
          </div>

          @if (movements().length === 0) {
            <p class="text-muted-foreground p-8 text-center text-sm">
              Sin movimientos registrados.
            </p>
          } @else {
            <div class="overflow-auto">
              <table class="w-full text-sm">
                <thead class="bg-muted/50 text-muted-foreground sticky top-0 text-left text-xs uppercase">
                  <tr>
                    <th class="px-4 py-2">Hora</th>
                    <th class="px-4 py-2">Tipo</th>
                    <th class="px-4 py-2">Motivo</th>
                    <th class="px-4 py-2 text-right">Monto</th>
                  </tr>
                </thead>
                <tbody class="divide-y">
                  @for (mov of movements(); track mov.id) {
                    <tr>
                      <td class="text-muted-foreground px-4 py-2 text-xs">{{ time(mov.createdAt) }}</td>
                      <td class="px-4 py-2">
                        <mo-badge [variant]="movBadge(mov)">{{ movLabel(mov.tipo) }}</mo-badge>
                      </td>
                      <td class="text-muted-foreground px-4 py-2">{{ mov.motivo }}</td>
                      <td
                        class="px-4 py-2 text-right font-semibold tabular-nums"
                        [class.text-emerald-600]="mov.tipo === 'cash_in'"
                        [class.text-destructive]="mov.tipo !== 'cash_in'"
                      >
                        {{ mov.tipo === 'cash_in' ? '+' : '−' }}{{ money(mov.amount) }}
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>
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
      (closed)="closeOpen.set(false)"
      (saved)="onClosed()"
    />
  `,
})
export class CajaPage {
  private readonly repo = inject(CashRegisterRepository)
  private readonly session = inject(SessionService)
  private readonly toast = inject(ToastService)

  readonly openSession = signal<CashSession | null>(null)
  readonly movements = signal<CashMovement[]>([])
  readonly breakdown = signal<PaymentBreakdown[]>([])
  readonly loading = signal(true)
  readonly loadError = signal<string | null>(null)
  readonly openError = signal<string | null>(null)
  readonly opening = signal(false)
  readonly movementOpen = signal(false)
  readonly closeOpen = signal(false)

  readonly openForm = new FormGroup({
    openingAmount: new FormControl<number>(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0)],
    }),
  })

  readonly movementsTotal = computed(() =>
    this.movements().reduce((sum, m) => sum + (m.tipo === 'cash_in' ? m.amount : -m.amount), 0),
  )
  readonly totalSales = computed(() => this.breakdown().reduce((sum, p) => sum + p.total, 0))
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

  async load(): Promise<void> {
    this.loading.set(true)
    this.loadError.set(null)
    try {
      const auth = await this.session.getAuthContext()
      if (!auth) throw new Error('No autenticado')

      const session = await this.repo.getOpenSession(auth.tiendaId)
      this.openSession.set(session)
      if (!session) {
        this.movements.set([])
        this.breakdown.set([])
      } else {
        const [movements, breakdown] = await Promise.all([
          this.repo.listMovements(session.id),
          this.repo.getPaymentBreakdown(session.id, auth.tiendaId),
        ])
        this.movements.set(movements)
        this.breakdown.set(breakdown)
      }
    } catch (error) {
      this.loadError.set(error instanceof Error ? error.message : 'Error al cargar caja')
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
      await this.repo.openSession({
        tiendaId: auth.tiendaId,
        openedBy: auth.userId,
        openingAmount: this.openForm.value.openingAmount ?? 0,
      })
      this.toast.success('Caja abierta')
      await this.load()
    } catch (error) {
      this.openError.set(error instanceof Error ? error.message : 'No se pudo abrir caja')
    } finally {
      this.opening.set(false)
    }
  }

  async reloadMovements(): Promise<void> {
    const session = this.openSession()
    if (!session) return
    const auth = await this.session.getAuthContext()
    if (!auth) return
    const [movements, breakdown] = await Promise.all([
      this.repo.listMovements(session.id),
      this.repo.getPaymentBreakdown(session.id, auth.tiendaId),
    ])
    this.movements.set(movements)
    this.breakdown.set(breakdown)
  }

  onClosed(): void {
    void this.load()
  }
}
