import { ChangeDetectionStrategy, Component, input } from '@angular/core'
import { formatCurrency } from '@/shared/lib/format'
import { CardComponent } from '../../shared/atoms/card.component'
import type { DailySalesSummary, HourlySalesSummary } from '@/modules/reports/domain/services/sales-trend'

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
  imports: [CardComponent],
  template: `
    <div class="grid gap-4 md:grid-cols-2">
      <mo-card>
        <h3 class="font-display mb-3 text-sm font-bold tracking-wide uppercase">
          Ventas por hora
        </h3>
        @if (hourlySales().length > 0) {
          <div class="overflow-auto">
            <table class="w-full text-sm">
              <thead class="text-muted-foreground text-xs uppercase">
                <tr class="text-left">
                  <th class="px-2 py-2">Hora</th>
                  <th class="px-2 py-2 text-right">Ventas</th>
                  <th class="px-2 py-2 text-right">Total</th>
                  <th class="px-2 py-2 text-right">Ticket prom.</th>
                </tr>
              </thead>
              <tbody class="divide-y">
                @for (row of hourlySales(); track row.hour) {
                  <tr>
                    <td class="px-2 py-2">{{ hourLabel(row.hour) }}</td>
                    <td class="px-2 py-2 text-right tabular-nums">{{ row.count }}</td>
                    <td class="px-2 py-2 text-right tabular-nums">{{ money(row.total) }}</td>
                    <td class="px-2 py-2 text-right tabular-nums">{{ money(row.avgTicket) }}</td>
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
            <table class="w-full text-sm">
              <thead class="text-muted-foreground text-xs uppercase">
                <tr class="text-left">
                  <th class="px-2 py-2">Día</th>
                  <th class="px-2 py-2 text-right">Ventas</th>
                  <th class="px-2 py-2 text-right">Total</th>
                  <th class="px-2 py-2 text-right">Ticket prom.</th>
                </tr>
              </thead>
              <tbody class="divide-y">
                @for (row of dailySales(); track row.date) {
                  <tr>
                    <td class="px-2 py-2">{{ row.date }}</td>
                    <td class="px-2 py-2 text-right tabular-nums">{{ row.count }}</td>
                    <td class="px-2 py-2 text-right tabular-nums">{{ money(row.total) }}</td>
                    <td class="px-2 py-2 text-right tabular-nums">{{ money(row.avgTicket) }}</td>
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

  money(v: number): string {
    return formatCurrency(v)
  }

  /** Formatea una hora `0..23` como `HH:00` (ej. `9` → `09:00`). */
  hourLabel(hour: number): string {
    return `${String(hour).padStart(2, '0')}:00`
  }
}
