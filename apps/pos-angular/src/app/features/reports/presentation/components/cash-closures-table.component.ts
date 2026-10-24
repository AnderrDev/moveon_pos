import { ChangeDetectionStrategy, Component, input } from '@angular/core'
import { formatTime } from '@/shared/lib/format'
import { BadgeComponent } from '@angular-app/shared/atoms/badge.component'
import { CardComponent } from '@angular-app/shared/atoms/card.component'
import type { DailySession } from '@angular-app/features/reports/domain/entities/report.entity'
import { MoneyPipe } from '@angular-app/shared/pipes/money.pipe'
import { MO_TABLE } from '@angular-app/shared/molecules/table/table.directives'

/**
 * Tabla "Cierres de caja": ventas/caja esperado vs real por sesión del
 * período (PLAN-41). Sesiones abiertas muestran un badge "En curso" en vez
 * de guiones; filas con diferencia ≠ 0 quedan resaltadas completas.
 */
@Component({
  selector: 'mo-cash-closures-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...MO_TABLE, MoneyPipe, BadgeComponent, CardComponent],
  template: `
    @if (sessions().length > 0) {
      <mo-card>
        <h3 class="font-display mb-3 text-sm font-bold">
          Cierres de caja
        </h3>
        <div class="overflow-auto">
          <table moTable density="compact">
            <thead moThead>
              <tr>
                <th moTh class="text-left">Sesión</th>
                <th moTh class="text-left hidden sm:table-cell">Cajero</th>
                <th moTh class="text-right">Ventas esperadas</th>
                <th moTh class="text-right">Ventas reales</th>
                <th moTh class="text-right">Diferencia</th>
                <th moTh class="hidden text-right sm:table-cell">Caja esperada</th>
                <th moTh class="text-right">Caja real</th>
                <th moTh class="text-right">Diferencia caja</th>
                <th moTh class="text-left hidden sm:table-cell">Notas</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              @for (s of sessions(); track s.id) {
                <tr [class]="rowClass(s)">
                  <td moTd class="text-muted-foreground text-xs">
                    {{ time(s.openedAt) }}
                    @if (s.closedAt) {
                      → {{ time(s.closedAt) }}
                    } @else {
                      <mo-badge variant="warning">En curso</mo-badge>
                    }
                  </td>
                  <td moTd class="text-muted-foreground hidden text-xs sm:table-cell">
                    {{ cashierLabel(s.openedBy) }}
                  </td>
                  <td moTd class="text-right tabular-nums">
                    {{ (s.expectedSalesAmount | money) }}
                  </td>
                  <td moTd class="text-right tabular-nums">
                    {{ s.actualSalesAmount !== null ? (s.actualSalesAmount | money) : '—' }}
                  </td>
                  <td moTd class="text-right tabular-nums"
                    [class.text-destructive]="(s.salesDifference ?? 0) > 0"
                    [class.text-emerald-600]="(s.salesDifference ?? 0) < 0"
                  >
                    {{ s.salesDifference !== null ? (s.salesDifference | money) : '—' }}
                  </td>
                  <td moTd class="hidden text-right tabular-nums sm:table-cell">
                    {{ (s.expectedCashAmount | money) }}
                  </td>
                  <td moTd class="text-right tabular-nums">
                    {{ s.actualCashAmount !== null ? (s.actualCashAmount | money) : '—' }}
                  </td>
                  <td moTd class="text-right tabular-nums"
                    [class.text-destructive]="(s.cashDifference ?? 0) > 0"
                    [class.text-emerald-600]="(s.cashDifference ?? 0) < 0"
                  >
                    {{ s.cashDifference !== null ? (s.cashDifference | money) : '—' }}
                  </td>
                  <td moTd class="text-muted-foreground hidden max-w-48 truncate text-xs sm:table-cell">
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
