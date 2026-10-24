import { ChangeDetectionStrategy, Component, input } from '@angular/core'
import { CardComponent } from '@angular-app/shared/atoms/card.component'
import type { DailySalesSummary, HourlySalesSummary } from '@angular-app/features/reports/domain/services/sales-trend'
import { MoneyPipe } from '@angular-app/shared/pipes/money.pipe'
import { MO_TABLE } from '@angular-app/shared/molecules/table/table.directives'

/**
 * Sección "Tendencia" del tab Ventas: dos tablas, "Ventas por hora" (suma
 * entre todos los días del período) y "Ventas por día" del período
 * seleccionado. Presentacional: solo recibe los agregados ya calculados por
 * `ReportsService.getDailyReport` (`hourlySales`/`dailySales`), sin Supabase
 * ni lógica de agregación — eso vive en `sales-trend.ts` (dominio puro).
 */
@Component({
  selector: 'mo-sales-trend-tables',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...MO_TABLE, MoneyPipe, CardComponent],
  template: `
    <div class="grid gap-4 md:grid-cols-2">
      <mo-card>
        <h3 class="font-display mb-3 text-sm font-bold tracking-wide uppercase">
          Ventas por hora
        </h3>
        @if (hourlySales().length > 0) {
          <div class="overflow-auto">
            <table moTable density="compact">
              <thead moThead>
                <tr>
                  <th moTh class="text-left">Hora</th>
                  <th moTh class="text-right">Ventas</th>
                  <th moTh class="text-right">Total</th>
                  <th moTh class="text-right">Ticket prom.</th>
                </tr>
              </thead>
              <tbody class="divide-y">
                @for (row of hourlySales(); track row.hour) {
                  <tr>
                    <td moTd>{{ hourLabel(row.hour) }}</td>
                    <td moTd class="text-right tabular-nums">{{ row.count }}</td>
                    <td moTd class="text-right tabular-nums">{{ (row.total | money) }}</td>
                    <td moTd class="text-right tabular-nums">{{ (row.avgTicket | money) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else {
          <p class="text-muted-foreground text-sm">Sin ventas en el período.</p>
        }
      </mo-card>

      <mo-card>
        <h3 class="font-display mb-3 text-sm font-bold tracking-wide uppercase">
          Ventas por día
        </h3>
        @if (dailySales().length > 0) {
          <div class="overflow-auto">
            <table moTable density="compact">
              <thead moThead>
                <tr>
                  <th moTh class="text-left">Día</th>
                  <th moTh class="text-right">Ventas</th>
                  <th moTh class="text-right">Total</th>
                  <th moTh class="text-right">Ticket prom.</th>
                </tr>
              </thead>
              <tbody class="divide-y">
                @for (row of dailySales(); track row.date) {
                  <tr>
                    <td moTd>{{ row.date }}</td>
                    <td moTd class="text-right tabular-nums">{{ row.count }}</td>
                    <td moTd class="text-right tabular-nums">{{ (row.total | money) }}</td>
                    <td moTd class="text-right tabular-nums">{{ (row.avgTicket | money) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else {
          <p class="text-muted-foreground text-sm">Sin ventas en el período.</p>
        }
      </mo-card>
    </div>
  `,
})
export class SalesTrendTablesComponent {
  readonly hourlySales = input.required<HourlySalesSummary[]>()
  readonly dailySales = input.required<DailySalesSummary[]>()


  /** Formatea una hora `0..23` como `HH:00` (ej. `9` → `09:00`). */
  hourLabel(hour: number): string {
    return `${String(hour).padStart(2, '0')}:00`
  }
}
