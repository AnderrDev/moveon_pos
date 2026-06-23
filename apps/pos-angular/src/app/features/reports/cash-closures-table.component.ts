import { ChangeDetectionStrategy, Component, input } from '@angular/core'
import { formatCurrency, formatTime } from '@/shared/lib/format'
import type { DailySession } from './reports.service'

/** Tabla "Cierres de caja": ventas/caja esperado vs real por sesión del período. */
@Component({
  selector: 'mo-cash-closures-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (sessions().length > 0) {
      <div class="bg-card rounded-xl border p-5">
        <h3 class="font-display mb-3 text-sm font-bold tracking-wide uppercase">
          Cierres de caja
        </h3>
        <div class="overflow-auto">
          <table class="w-full text-sm">
            <thead class="text-muted-foreground text-xs uppercase">
              <tr class="text-left">
                <th class="px-2 py-2">Sesion</th>
                <th class="px-2 py-2 text-right">Ventas esp.</th>
                <th class="px-2 py-2 text-right">Ventas real</th>
                <th class="px-2 py-2 text-right">Dif.</th>
                <th class="px-2 py-2 text-right">Caja esp.</th>
                <th class="px-2 py-2 text-right">Caja real</th>
                <th class="px-2 py-2 text-right">Dif. caja</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              @for (s of sessions(); track s.id) {
                <tr>
                  <td class="text-muted-foreground px-2 py-2 text-xs">
                    {{ time(s.openedAt) }}
                    @if (s.closedAt) {
                      → {{ time(s.closedAt) }}
                    }
                  </td>
                  <td class="px-2 py-2 text-right tabular-nums">
                    {{ money(s.expectedSalesAmount) }}
                  </td>
                  <td class="px-2 py-2 text-right tabular-nums">
                    {{ s.actualSalesAmount !== null ? money(s.actualSalesAmount) : '—' }}
                  </td>
                  <td
                    class="px-2 py-2 text-right tabular-nums"
                    [class.text-destructive]="(s.salesDifference ?? 0) > 0"
                    [class.text-emerald-600]="(s.salesDifference ?? 0) < 0"
                  >
                    {{ s.salesDifference !== null ? money(s.salesDifference) : '—' }}
                  </td>
                  <td class="px-2 py-2 text-right tabular-nums">
                    {{ money(s.expectedCashAmount) }}
                  </td>
                  <td class="px-2 py-2 text-right tabular-nums">
                    {{ s.actualCashAmount !== null ? money(s.actualCashAmount) : '—' }}
                  </td>
                  <td
                    class="px-2 py-2 text-right tabular-nums"
                    [class.text-destructive]="(s.cashDifference ?? 0) > 0"
                    [class.text-emerald-600]="(s.cashDifference ?? 0) < 0"
                  >
                    {{ s.cashDifference !== null ? money(s.cashDifference) : '—' }}
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    }
  `,
})
export class CashClosuresTableComponent {
  readonly sessions = input.required<DailySession[]>()

  money(v: number): string {
    return formatCurrency(v)
  }

  time(d: Date): string {
    return formatTime(d)
  }
}
