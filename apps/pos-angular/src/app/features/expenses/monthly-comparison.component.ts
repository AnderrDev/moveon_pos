import { ChangeDetectionStrategy, Component, input } from '@angular/core'
import { formatCurrency } from '@/shared/lib/format'
import type { MonthlyComparisonRow } from '@/modules/expenses/domain/services/monthly-comparison'

/** Tendencia mensual entradas vs. gastos. Presentacional. */
@Component({
  selector: 'mo-monthly-comparison',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-card overflow-auto rounded-xl border">
      <div class="border-b px-4 py-3">
        <h3 class="text-sm font-semibold">Comparativa mensual</h3>
        <p class="text-muted-foreground text-xs">
          Balance = entradas − gastos del negocio (no descuenta el costo de los productos)
        </p>
      </div>
      <table class="w-full text-sm">
        <thead
          class="bg-muted/50 text-muted-foreground text-left text-xs tracking-wide uppercase"
        >
          <tr>
            <th class="px-4 py-3">Mes</th>
            <th class="px-4 py-3 text-right">Entradas</th>
            <th class="px-4 py-3 text-right">Gastos</th>
            <th class="px-4 py-3 text-right">Gastos/Entradas</th>
            <th class="px-4 py-3 text-right">Balance</th>
          </tr>
        </thead>
        <tbody class="divide-y">
          @for (row of rows(); track row.month) {
            <tr class="hover:bg-muted/30">
              <td class="px-4 py-3 font-semibold capitalize whitespace-nowrap">
                {{ monthLabel(row.month) }}
              </td>
              <td class="px-4 py-3 text-right whitespace-nowrap">{{ money(row.entradas) }}</td>
              <td class="px-4 py-3 text-right whitespace-nowrap">{{ money(row.gastos) }}</td>
              <td class="text-muted-foreground px-4 py-3 text-right whitespace-nowrap">
                @if (row.pctGastos !== null) {
                  {{ row.pctGastos }}%
                } @else {
                  —
                }
              </td>
              <td
                class="px-4 py-3 text-right font-semibold whitespace-nowrap"
                [class.text-emerald-600]="row.balance > 0"
                [class.text-destructive]="row.balance < 0"
              >
                {{ money(row.balance) }}
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class MonthlyComparisonComponent {
  readonly rows = input.required<MonthlyComparisonRow[]>()

  monthLabel(month: string): string {
    const [y, m] = month.split('-').map(Number)
    return new Date(y, m - 1, 1).toLocaleDateString('es-CO', { month: 'short', year: 'numeric' })
  }

  money(v: number): string {
    return formatCurrency(v)
  }
}
