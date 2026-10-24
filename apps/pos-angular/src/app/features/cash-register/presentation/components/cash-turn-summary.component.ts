import { ChangeDetectionStrategy, Component, input } from '@angular/core'
import { formatShortDate, formatTime } from '@/shared/lib/format'
import type { CashSession } from '@angular-app/features/cash-register/domain/entities/cash-session.entity'
import type { PaymentBreakdown } from '@angular-app/features/cash-register/domain/repositories/cash-register.repository'
import type { computeCashTurnSummary } from '@angular-app/features/cash-register/domain/services/cash-closure'
import { MoneyPipe } from '@angular-app/shared/pipes/money.pipe'
import { PaymentLabelPipe } from '@angular-app/shared/pipes/payment-label.pipe'

type CashTurnSummary = ReturnType<typeof computeCashTurnSummary>

/** Apertura, totales, cuadre del efectivo y resumen por método del turno abierto. */
@Component({
  selector: 'mo-cash-turn-summary',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'grid gap-4 lg:grid-cols-3' },
  imports: [MoneyPipe, PaymentLabelPipe],
  template: `
    <div class="bg-card rounded-xl border p-5 lg:col-span-2">
      <p class="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Caja abierta</p>
      <h2 class="font-display mt-1 text-2xl font-bold">{{ (session().openingAmount | money) }}</h2>
      <p class="text-muted-foreground text-xs">
        {{ shortDate(session().openedAt) }} · {{ time(session().openedAt) }}
      </p>

      <div class="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div class="rounded-lg border px-3 py-2">
          <p class="text-muted-foreground text-[11px] font-semibold uppercase">Total ventas</p>
          <p class="font-bold tabular-nums">{{ (totalSales() | money) }}</p>
        </div>
        <div class="rounded-lg border px-3 py-2">
          <p class="text-muted-foreground text-[11px] font-semibold uppercase">Movimientos</p>
          <p class="font-bold tabular-nums">
            {{ summary().movementsTotal >= 0 ? '+' : '' }}{{ (summary().movementsTotal | money) }}
          </p>
        </div>
        <div class="rounded-lg border px-3 py-2">
          <p class="text-muted-foreground text-[11px] font-semibold uppercase">Esperado en caja</p>
          <p class="font-bold tabular-nums">{{ (summary().expectedCashAmount | money) }}</p>
        </div>
      </div>

      <div class="bg-muted/20 mt-5 rounded-xl border p-4">
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="text-xs font-bold tracking-wide uppercase">Cuadre del turno</p>
            <p class="text-muted-foreground text-xs">Así se calcula el efectivo físico esperado.</p>
          </div>
          <p class="font-display text-lg font-bold tabular-nums">{{ (summary().expectedCashAmount | money) }}</p>
        </div>
        <dl class="mt-3 grid grid-cols-1 gap-x-5 gap-y-1.5 text-sm sm:grid-cols-2">
          @for (line of lines(); track line.label) {
            <div class="flex justify-between gap-3">
              <dt>{{ line.label }}</dt>
              <dd class="font-mono tabular-nums">{{ line.sign }}{{ (line.amount | money) }}</dd>
            </div>
          }
        </dl>
      </div>
    </div>

    <div class="bg-card rounded-xl border p-5">
      <p class="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Por metodo de pago</p>
      <div class="mt-3 space-y-3">
        @for (item of paymentSummary(); track item.metodo) {
          <div class="rounded-xl border p-3">
            <div class="flex items-center justify-between gap-3">
              <span class="text-sm font-semibold">{{ (item.metodo | paymentLabel) }}</span>
              <span class="font-mono font-bold tabular-nums">{{ (item.total | money) }}</span>
            </div>
            <p class="text-muted-foreground mt-1 text-xs">
              {{ item.count }} {{ item.count === 1 ? 'venta' : 'ventas' }}
            </p>
          </div>
        }
      </div>
    </div>
  `,
})
export class CashTurnSummaryComponent {
  readonly session = input.required<CashSession>()
  readonly summary = input.required<CashTurnSummary>()
  readonly totalSales = input.required<number>()
  readonly paymentSummary = input.required<PaymentBreakdown[]>()

  lines(): { label: string; sign: string; amount: number }[] {
    const s = this.summary()
    return [
      { label: 'Base de apertura', sign: '', amount: s.openingAmount },
      { label: 'Ventas en efectivo', sign: '+', amount: s.cashSalesAmount },
      { label: 'Entradas', sign: '+', amount: s.cashInAmount },
      { label: 'Gastos', sign: '−', amount: s.expenseAmount },
      { label: 'Retiros', sign: '−', amount: s.cashOutAmount },
      { label: 'Correcciones', sign: '−', amount: s.correctionAmount },
    ]
  }

  time(d: Date): string {
    return formatTime(d)
  }

  shortDate(d: Date): string {
    return formatShortDate(d)
  }
}
