import { ChangeDetectionStrategy, Component, input } from '@angular/core'
import { formatCurrency } from '@/shared/lib/format'
import { StatCardComponent } from '../../shared/molecules/stat-card.component'
import type { DailyReport } from './reports.service'

/** Las 6 tarjetas KPI del tab "Ventas": total, descuentos, ticket promedio, IVA, anuladas, utilidad. */
@Component({
  selector: 'mo-daily-kpi-cards',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StatCardComponent],
  template: `
    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
      <mo-stat-card
        label="Total ventas"
        [value]="money(report().totalVentas)"
        [hint]="report().countVentas + ' ventas'"
      />
      <mo-stat-card
        label="Descuentos"
        tone="warning"
        [value]="money(report().discountTotal)"
        [hint]="
          report().discountedSalesCount +
          ' ventas · promedio ' +
          percent(report().averageDiscountPercentage)
        "
      />
      <mo-stat-card label="Ticket promedio" [value]="money(report().avgVenta)" />
      <mo-stat-card label="IVA" [value]="money(report().taxTotal)" />
      <mo-stat-card label="Anuladas" [value]="'' + report().countAnuladas" />
      @if (hasKnownCost()) {
        <mo-stat-card label="Utilidad" [value]="money(report().utilidadTotal)" />
      } @else {
        <mo-stat-card
          label="Utilidad"
          tone="muted"
          value="—"
          hint="Configura el costo de tus productos para verla"
        />
      }
    </div>
  `,
})
export class DailyKpiCardsComponent {
  readonly report = input.required<DailyReport>()

  money(v: number): string {
    return formatCurrency(v)
  }

  percent(value: number): string {
    return `${value.toFixed(2)}%`
  }

  hasKnownCost(): boolean {
    return this.report().productSales.some((p) => p.costoUnitario !== null)
  }
}
