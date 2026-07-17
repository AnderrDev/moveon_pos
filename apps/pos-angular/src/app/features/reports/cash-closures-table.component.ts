import { ChangeDetectionStrategy, Component, input } from '@angular/core'
import { formatCurrency, formatTime } from '@/shared/lib/format'
import { BadgeComponent } from '../../shared/atoms/badge.component'
import { CardComponent } from '../../shared/atoms/card.component'
import type { DailySession } from './reports.service'

/**
 * Tabla "Cierres de caja": ventas/caja esperado vs real por sesión del
 * período (PLAN-41). Sesiones abiertas muestran un badge "En curso" en vez
 * de guiones; filas con diferencia ≠ 0 quedan resaltadas completas.
 */
@Component({
  selector: 'mo-cash-closures-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent, CardComponent],
  template: `
    @if (sessions().length > 0) {
      <mo-card>
        <h3 class="font-display mb-3 text-sm font-bold tracking-wide uppercase">
          Cierres de caja
        </h3>
        <div class="overflow-auto">
          <table class="w-full text-sm">
            <thead class="text-muted-foreground text-xs uppercase">
              <tr class="text-left">
                <th class="px-2 py-2">Sesión</th>
                <th class="hidden px-2 py-2 sm:table-cell">Cajero</th>
                <th class="px-2 py-2 text-right">Ventas esperadas</th>
                <th class="px-2 py-2 text-right">Ventas reales</th>
                <th class="px-2 py-2 text-right">Diferencia</th>
                <th class="hidden px-2 py-2 text-right sm:table-cell">Caja esperada</th>
                <th class="px-2 py-2 text-right">Caja real</th>
                <th class="px-2 py-2 text-right">Diferencia caja</th>
                <th class="hidden px-2 py-2 sm:table-cell">Notas</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              @for (s of sessions(); track s.id) {
                <tr [class]="rowClass(s)">
                  <td class="text-muted-foreground px-2 py-2 text-xs">
                    {{ time(s.openedAt) }}
                    @if (s.closedAt) {
                      → {{ time(s.closedAt) }}
                    } @else {
                      <mo-badge variant="warning">En curso</mo-badge>
                    }
                  </td>
                  <td class="text-muted-foreground hidden px-2 py-2 text-xs sm:table-cell">
                    {{ cashierLabel(s.openedBy) }}
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
                  <td class="hidden px-2 py-2 text-right tabular-nums sm:table-cell">
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
                  <td class="text-muted-foreground hidden max-w-48 truncate px-2 py-2 text-xs sm:table-cell">
                    {{ s.notasCierre || '—' }}
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </mo-card>
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

  cashierLabel(id: string): string {
    return `Cajero ${id.slice(0, 8)}`
  }

  rowClass(s: DailySession): string {
    const hasDifference = (s.salesDifference ?? 0) !== 0 || (s.cashDifference ?? 0) !== 0
    return hasDifference ? 'bg-destructive/5' : ''
  }
}
