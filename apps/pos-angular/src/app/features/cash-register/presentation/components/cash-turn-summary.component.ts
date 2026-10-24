import { ChangeDetectionStrategy, Component, input } from '@angular/core'
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
    <div class="bg-card rounded-xl border lg:col-span-2">
      <div class="p-5">
        <p class="text-muted-foreground text-sm font-medium">Efectivo esperado en el cajón</p>
        <p class="font-display mt-1 text-4xl font-black tabular-nums">
          {{ (summary().expectedCashAmount | money) }}
        </p>
        <p class="text-muted-foreground mt-1 text-xs">
          Base, más ventas en efectivo y entradas, menos gastos, retiros y correcciones.
        </p>
      </div>

      <dl class="grid grid-cols-3 divide-x border-y">
        <div class="px-5 py-3">
          <dt class="text-muted-foreground text-xs font-medium">Ventas del turno</dt>
          <dd class="mt-0.5 font-bold tabular-nums">{{ (totalSales() | money) }}</dd>
        </div>
        <div class="px-5 py-3">
          <dt class="text-muted-foreground text-xs font-medium">Movimientos</dt>
          <dd class="mt-0.5 font-bold tabular-nums">
            {{ summary().movementsTotal >= 0 ? '+' : '' }}{{ (summary().movementsTotal | money) }}
          </dd>
        </div>
        <div class="px-5 py-3">
          <dt class="text-muted-foreground text-xs font-medium">Base de apertura</dt>
          <dd class="mt-0.5 font-bold tabular-nums">{{ (session().openingAmount | money) }}</dd>
        </div>
      </dl>

      <div class="p-5">
        <h3 class="text-sm font-bold">Cuadre del efectivo</h3>
        <dl class="mt-2 grid grid-cols-1 gap-x-8 gap-y-1.5 text-sm sm:grid-cols-2">
          @for (line of lines(); track line.label) {
            <div class="flex justify-between gap-3">
              <dt class="text-muted-foreground">{{ line.label }}</dt>
              <dd class="font-medium tabular-nums">{{ line.sign }}{{ (line.amount | money) }}</dd>
            </div>
          }
        </dl>
      </div>
    </div>

    <div class="bg-card rounded-xl border p-5">
      <h3 class="text-sm font-bold">Ventas por método de pago</h3>
      <ul class="mt-2 divide-y">
        @for (item of paymentSummary(); track item.metodo) {
          <li class="flex items-baseline justify-between gap-3 py-3">
            <span>
              <span class="block text-sm font-semibold">{{ (item.metodo | paymentLabel) }}</span>
              <span class="text-muted-foreground text-xs">
                {{ item.count }} {{ item.count === 1 ? 'venta' : 'ventas' }}
              </span>
            </span>
            <span class="font-display text-lg font-extrabold tabular-nums">{{ (item.total | money) }}</span>
          </li>
        }
      </ul>
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
}
