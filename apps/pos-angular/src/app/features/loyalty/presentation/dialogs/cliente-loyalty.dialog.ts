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
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms'
import { getErrorMessage } from '@/shared/lib/error-message'
import { formatCurrency, formatShortDate, formatTime } from '@/shared/lib/format'
import {
  adjustStampsFormSchema,
  createAdjustStampsFormDefaults,
} from '@angular-app/features/loyalty/presentation/forms/adjust-stamps-form.factory'
import { adjustStampsFormMapper } from '@angular-app/features/loyalty/presentation/forms/adjust-stamps-form.mapper'
import type {
  LoyaltyReward,
  LoyaltyTransaction,
  LoyaltyTransactionType,
} from '@angular-app/features/loyalty/domain/entities/loyalty.entity'
import type { Cliente } from '@angular-app/features/customers/domain/entities/cliente.entity'
import { DEFAULT_LOYALTY_CONFIG, type LoyaltyConfig } from '@angular-app/features/loyalty/domain/loyalty-config'
import { DialogComponent } from '@angular-app/shared/organisms/dialog.component'
import { ButtonComponent } from '@angular-app/shared/atoms/button.component'
import { FormNumberInputComponent } from '@angular-app/shared/molecules/form-number-input.component'
import { FormInputComponent } from '@angular-app/shared/molecules/form-input.component'
import { FormErrorComponent } from '@angular-app/shared/molecules/form-error.component'
import { MO_TABLE } from '@angular-app/shared/molecules/table/table.directives'
import { LoyaltyRepository, type LoyaltySummary } from '@angular-app/features/loyalty/data/repositories/loyalty.repository'
import { SessionService } from '@angular-app/core/auth/session.service'
import { TiendaInfoService } from '@angular-app/core/tienda/tienda-info.service'
import { ToastService } from '@angular-app/shared/organisms/toast/toast.service'

const TYPE_LABELS: Record<LoyaltyTransactionType, string> = {
  earn: 'Sellos ganados',
  redeem: 'Recompensa desbloqueada',
  void: 'Reversa por anulación',
  adjustment: 'Ajuste manual',
  expire: 'Recompensa vencida',
}

/**
 * Ficha MOVE ON Club del cliente (PLAN-57 + PLAN-58): progreso, recompensas
 * vigentes, historial cronológico del ledger y — solo admin — ajuste manual
 * de sellos (RN-LF16).
 */
@Component({
  selector: 'mo-cliente-loyalty-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    DialogComponent,
    ButtonComponent,
    FormNumberInputComponent,
    FormInputComponent,
    FormErrorComponent,
    MO_TABLE,
  ],
  template: `
    <mo-dialog
      [open]="open()"
      [title]="dialogTitle()"
      [busy]="adjusting()"
      width="lg"
      (closed)="onClose()"
    >
      @if (loading()) {
        <div class="animate-pulse space-y-3">
          <div class="bg-muted/50 h-20 rounded-xl"></div>
          <div class="bg-muted/50 h-40 rounded-xl"></div>
        </div>
      } @else if (loadError()) {
        <div class="space-y-3">
          <p class="text-destructive text-sm font-semibold">{{ loadError() }}</p>
          <mo-button size="sm" variant="outline" (click)="reload()">Reintentar</mo-button>
        </div>
      } @else {
        <div class="space-y-5">
          <!-- Resumen -->
          <div class="grid gap-3 sm:grid-cols-3">
            <div class="bg-primary/10 border-primary/25 rounded-xl border p-4">
              <p class="text-muted-foreground text-xs font-semibold uppercase">Sellos</p>
              <p class="font-display mt-1 text-2xl font-bold">
                {{ summary()?.stampsBalance ?? 0 }}<span class="text-muted-foreground text-sm font-semibold">/{{ stampsPerReward() }}</span>
              </p>
              <div class="bg-muted mt-2 h-2 overflow-hidden rounded-full">
                <div class="bg-primary h-full rounded-full" [style.width.%]="progressPct()"></div>
              </div>
            </div>
            <div class="bg-card rounded-xl border p-4">
              <p class="text-muted-foreground text-xs font-semibold uppercase">Total ganados</p>
              <p class="font-display mt-1 text-2xl font-bold">{{ summary()?.totalStampsEarned ?? 0 }}</p>
            </div>
            <div class="bg-card rounded-xl border p-4">
              <p class="text-muted-foreground text-xs font-semibold uppercase">Batidos canjeados</p>
              <p class="font-display mt-1 text-2xl font-bold">{{ summary()?.totalRewardsRedeemed ?? 0 }}</p>
            </div>
          </div>

          <!-- Recompensas vigentes -->
          @if (availableRewards().length > 0) {
            <div class="border-primary/30 bg-primary/5 rounded-xl border p-4">
              <p class="text-sm font-bold">
                🎁 {{ availableRewards().length }}
                {{ availableRewards().length === 1 ? 'batido gratis disponible' : 'batidos gratis disponibles' }}
              </p>
              <ul class="text-muted-foreground mt-1.5 space-y-0.5 text-xs">
                @for (r of availableRewards(); track r.id) {
                  <li>
                    Hasta {{ formatCop(r.rewardValueCop) }} — vence el {{ formatDate(r.expiresAt) }}
                  </li>
                }
              </ul>
            </div>
          }

          <!-- Ajuste manual (solo admin, PLAN-58) -->
          @if (isAdmin()) {
            <form
              [formGroup]="adjustForm"
              (ngSubmit)="submitAdjust()"
              class="bg-muted/30 space-y-3 rounded-xl border p-4"
            >
              <p class="text-xs font-bold tracking-wide uppercase">Ajuste manual de sellos</p>
              <div class="grid gap-3 sm:grid-cols-[8rem_minmax(0,1fr)_auto]">
                <mo-form-number-input
                  controlName="delta"
                  label="Sellos (+/−)"
                  placeholder="Ej: 2 o -1"
                  [min]="null"
                  [error]="adjustErrors().delta ?? null"
                />
                <mo-form-input
                  controlName="reason"
                  label="Motivo"
                  placeholder="Ej: compensación por venta sin registrar"
                  [required]="true"
                  [maxLength]="200"
                  [error]="adjustErrors().reason ?? null"
                />
                <mo-button
                  type="submit"
                  class="self-end"
                  [loading]="adjusting()"
                  loadingText="Ajustando..."
                >
                  Ajustar
                </mo-button>
              </div>
              <p class="text-muted-foreground text-[11px]">
                Queda en el historial del cliente y en la auditoría con tu usuario.
              </p>
              <mo-form-error [message]="adjustErrors().root ?? null" />
            </form>
          }

          <!-- Historial (PLAN-57) -->
          <div>
            <p class="mb-2 text-xs font-bold tracking-wide uppercase">Historial</p>
            @if (transactions().length === 0) {
              <p class="text-muted-foreground rounded-xl border border-dashed p-4 text-center text-sm">
                Sin movimientos todavía. Los sellos aparecen al comprar batidos del club.
              </p>
            } @else {
              <div class="max-h-72 overflow-auto rounded-xl border">
                <table moTable density="compact">
                  <thead moThead class="sticky top-0 text-left tracking-wide">
                    <tr>
                      <th moTh>Fecha</th>
                      <th moTh>Movimiento</th>
                      <th moTh class="text-right">Sellos</th>
                      <th moTh class="text-right">Saldo</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y">
                    @for (t of transactions(); track t.id) {
                      <tr>
                        <td moTd class="text-muted-foreground text-xs whitespace-nowrap">
                          {{ formatDate(t.createdAt) }} · {{ formatHour(t.createdAt) }}
                        </td>
                        <td moTd>
                          <p class="font-semibold">{{ typeLabel(t.type) }}</p>
                          @if (t.reason) {
                            <p class="text-muted-foreground text-xs">{{ t.reason }}</p>
                          }
                        </td>
                        <td
                          moTd
                          class="text-right font-bold tabular-nums"
                          [class.text-emerald-600]="t.stampsDelta > 0"
                          [class.text-destructive]="t.stampsDelta < 0"
                        >
                          {{ t.stampsDelta > 0 ? '+' : '' }}{{ t.stampsDelta }}
                        </td>
                        <td moTd class="text-muted-foreground text-right tabular-nums">
                          {{ t.balanceAfter }}
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </div>
        </div>
      }
    </mo-dialog>
  `,
})
export class ClienteLoyaltyDialog {
  private readonly loyaltyRepo = inject(LoyaltyRepository)
  private readonly session = inject(SessionService)
  private readonly tiendaInfo = inject(TiendaInfoService)
  private readonly toast = inject(ToastService)

  readonly open = input<boolean>(false)
  readonly cliente = input<Cliente | null>(null)

  readonly closed = output<void>()

  readonly loading = signal(true)
  readonly loadError = signal<string | null>(null)
  readonly summary = signal<LoyaltySummary | null>(null)
  readonly transactions = signal<LoyaltyTransaction[]>([])
  readonly config = signal<LoyaltyConfig>(DEFAULT_LOYALTY_CONFIG)
  readonly adjusting = signal(false)
  readonly adjustErrors = signal<Partial<Record<'delta' | 'reason' | 'root', string>>>({})
  readonly isAdmin = this.session.isAdmin

  readonly adjustForm = new FormGroup({
    delta: new FormControl<number | null>(null),
    reason: new FormControl<string>('', { nonNullable: true }),
  })

  readonly dialogTitle = computed(() => {
    const nombre = this.cliente()?.nombre
    return nombre ? `MOVE ON Club — ${nombre}` : 'MOVE ON Club'
  })

  readonly stampsPerReward = computed(() => this.config().sellosParaRecompensa)

  readonly progressPct = computed(() => {
    const per = this.stampsPerReward()
    if (per <= 0) return 0
    const balance = this.summary()?.stampsBalance ?? 0
    return Math.min(100, Math.round((balance / per) * 100))
  })

  readonly availableRewards = computed<LoyaltyReward[]>(
    () => this.summary()?.availableRewards ?? [],
  )

  constructor() {
    void this.session.getRole()
    effect(() => {
      if (this.open() && this.cliente()) {
        this.adjustForm.reset(createAdjustStampsFormDefaults())
        this.adjustErrors.set({})
        void this.load()
      }
    })
  }

  async load(): Promise<void> {
    const cliente = this.cliente()
    if (!cliente) return
    this.loading.set(true)
    this.loadError.set(null)
    try {
      const auth = await this.session.getAuthContext()
      if (!auth) throw new Error('Sesión expirada')

      // Barrido de vencimiento oportunista (PLAN-60): si el RPC aún no está
      // desplegado en este entorno, el historial sigue funcionando igual.
      await this.loyaltyRepo.expireRewards(auth.tiendaId).catch(() => 0)

      const [info, summary, transactions] = await Promise.all([
        this.tiendaInfo.get(auth.tiendaId),
        this.loyaltyRepo.getSummary(auth.tiendaId, cliente.id),
        this.loyaltyRepo.listTransactions(auth.tiendaId, cliente.id),
      ])
      this.config.set(info.fidelizacion)
      this.summary.set(summary)
      this.transactions.set(transactions)
    } catch (error) {
      this.loadError.set(getErrorMessage(error, 'No se pudo cargar la información del club'))
    } finally {
      this.loading.set(false)
    }
  }

  reload(): void {
    void this.load()
  }

  async submitAdjust(): Promise<void> {
    if (this.adjusting()) return
    this.adjustForm.markAllAsTouched()

    const raw = this.adjustForm.getRawValue()
    const parsed = adjustStampsFormSchema.safeParse({
      delta: raw.delta ?? Number.NaN,
      reason: raw.reason,
    })
    if (!parsed.success) {
      const errors: Partial<Record<'delta' | 'reason', string>> = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as 'delta' | 'reason' | undefined
        if (field && !errors[field]) errors[field] = issue.message
      }
      this.adjustErrors.set(errors)
      return
    }

    const cliente = this.cliente()
    const auth = await this.session.getAuthContext()
    if (!cliente || !auth) {
      this.adjustErrors.set({ root: 'Sesión expirada' })
      return
    }

    this.adjusting.set(true)
    this.adjustErrors.set({})
    try {
      const newBalance = await this.loyaltyRepo.adjustStamps(
        adjustStampsFormMapper.toPayload(parsed.data, {
          tiendaId: auth.tiendaId,
          clienteId: cliente.id,
          createdBy: auth.userId,
        }),
      )
      this.toast.success(`Sellos ajustados. Nuevo saldo: ${newBalance}`)
      this.adjustForm.reset(createAdjustStampsFormDefaults())
      await this.load()
    } catch (error) {
      this.adjustErrors.set({
        root: getErrorMessage(error, 'No se pudo ajustar los sellos'),
      })
    } finally {
      this.adjusting.set(false)
    }
  }

  onClose(): void {
    if (this.adjusting()) return
    this.closed.emit()
  }

  typeLabel(type: LoyaltyTransactionType): string {
    return TYPE_LABELS[type] ?? type
  }

  formatCop(value: number): string {
    return formatCurrency(value)
  }

  formatDate(date: Date): string {
    return formatShortDate(date)
  }

  formatHour(date: Date): string {
    return formatTime(date)
  }
}
