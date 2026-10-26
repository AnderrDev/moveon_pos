import { ChangeDetectionStrategy, Component, input } from '@angular/core'
import { StatCardComponent } from '@angular-app/shared/molecules/stat-card.component'
import type { DailyReport } from '@angular-app/features/reports/domain/entities/report.entity'
import { MoneyPipe } from '@angular-app/shared/pipes/money.pipe'
import { formatCurrency } from '@/shared/lib/format'

/** Las 5 tarjetas KPI del tab "Ventas": total, descuentos, ticket promedio, anuladas, utilidad. */
@Component({
  selector: 'mo-daily-kpi-cards',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MoneyPipe, StatCardComponent],
  template: `
    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <mo-stat-card
        label="Total ventas"
        [value]="(report().totalVentas | money)"
        [hint]="totalHint()"
      />
      <mo-stat-card
        label="Descuentos"
        tone="warning"
        [value]="(report().discountTotal | money)"
        [hint]="
          report().discountedSalesCount +
          ' ventas · promedio ' +
          percent(report().averageDiscountPercentage)
        "
      />
      <mo-stat-card label="Ticket promedio" [value]="(report().avgVenta | money)" />
      <mo-stat-card label="Anuladas" [value]="'' + report().countAnuladas" />
      @if (hasKnownCost()) {
        <mo-stat-card label="Utilidad" [value]="(report().utilidadTotal | money)" />
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


  /** El recargo por tarjeta no suma al total: se informa aparte (ADR 0024). */
  totalHint(): string {
    const report = this.report()
    const ventas = `${report.countVentas} ventas`
    if (report.cardSurchargeTotal <= 0) return ventas
    return `${ventas} · + ${formatCurrency(report.cardSurchargeTotal)} recargo tarjeta (comisión Nequi)`
  }

  percent(value: number): string {
    return `${value.toFixed(2)}%`
  }

  hasKnownCost(): boolean {
    return this.report().productSales.some((p) => p.costoUnitario !== null)
  }
}
