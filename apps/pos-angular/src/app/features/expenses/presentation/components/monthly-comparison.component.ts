import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core'
import {
  GroupedColumnChartComponent,
  type GroupedCategory,
  type GroupedSeries,
} from '@angular-app/shared/molecules/charts/grouped-column-chart.component'
import { MO_TABLE } from '@angular-app/shared/molecules/table/table.directives'
import type { MonthlyComparisonRow } from '@angular-app/features/expenses/domain/services/monthly-comparison'
import { MoneyPipe } from '@angular-app/shared/pipes/money.pipe'

/** Tendencia mensual de la ganancia (misma cuenta del resumen): gráfica + tabla a un clic. Presentacional. */
@Component({
  selector: 'mo-monthly-comparison',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MoneyPipe, MO_TABLE, GroupedColumnChartComponent],
  template: `
    <div class="bg-card rounded-xl border p-4">
      <h3 class="text-sm font-semibold">Ganancia de los últimos 6 meses</h3>
      <p class="text-muted-foreground mb-3 text-xs">
        Misma cuenta del resumen: ventas − costo de lo vendido − gastos. Si a un mes le falta registrar
        el arriendo o la nómina, su ganancia se verá más alta de lo real.
      </p>
      <mo-grouped-column-chart
        [series]="series"
        [categories]="categories()"
        [showTable]="false"
        ariaLabel="Ventas, costo de lo vendido, gastos y ganancia por mes"
      />
      <details class="mt-3 text-xs">
        <summary class="text-muted-foreground hover:text-foreground cursor-pointer select-none">Ver la tabla mes a mes</summary>
        <table moTable class="mt-2">
          <thead class="text-muted-foreground text-left text-xs">
            <tr>
              <th moTh>Mes</th>
              <th moTh class="text-right">Ventas</th>
              <th moTh class="text-right">− Costo de lo vendido</th>
              <th moTh class="text-right">− Gastos</th>
              <th moTh class="text-right">= Ganancia</th>
              <th moTh class="text-right">% de lo vendido</th>
            </tr>
          </thead>
          <tbody class="divide-y">
            @for (row of rows(); track row.month) {
              <tr class="hover:bg-muted/30">
                <td moTd class="font-semibold capitalize whitespace-nowrap">{{ monthLabel(row.month) }}</td>
                <td moTd class="text-right whitespace-nowrap">{{ (row.entradas | money) }}</td>
                <td moTd class="text-right whitespace-nowrap">{{ (row.costoMercancia | money) }}</td>
                <td moTd class="text-right whitespace-nowrap">{{ (row.gastos | money) }}</td>
                <td
                  moTd
                  class="text-right font-semibold whitespace-nowrap"
                  [class.text-emerald-700]="row.ganancia > 0"
                  [class.text-destructive]="row.ganancia < 0"
                >
                  {{ (row.ganancia | money) }}
                </td>
                <td moTd class="text-muted-foreground text-right whitespace-nowrap">
                  @if (row.margen !== null) {
                    {{ row.margen }}%
                  } @else {
                    —
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </details>
    </div>
  `,
})
export class MonthlyComparisonComponent {
  readonly rows = input.required<MonthlyComparisonRow[]>()

  /** La gráfica tiene 3 colores: costo de lo vendido y gastos van juntos (la tabla los separa). */
  readonly series: GroupedSeries[] = [{ name: 'Ventas' }, { name: 'Costo + gastos' }, { name: 'Ganancia' }]
  readonly categories = computed<GroupedCategory[]>(() =>
    this.rows().map((r) => ({ key: r.month, label: this.shortMonth(r.month), values: [r.entradas, r.costoMercancia + r.gastos, r.ganancia] })),
  )

  shortMonth(month: string): string {
    const [y, m] = month.split('-').map(Number)
    return new Date(y, m - 1, 1).toLocaleDateString('es-CO', { month: 'short' }).replace('.', '')
  }

  monthLabel(month: string): string {
    const [y, m] = month.split('-').map(Number)
    return new Date(y, m - 1, 1).toLocaleDateString('es-CO', { month: 'short', year: 'numeric' })
  }

}
