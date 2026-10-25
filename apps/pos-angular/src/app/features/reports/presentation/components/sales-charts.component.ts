import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core'
import { CardComponent } from '@angular-app/shared/atoms/card.component'
import { ColumnChartComponent } from '@angular-app/shared/molecules/charts/column-chart.component'
import { BarListChartComponent } from '@angular-app/shared/molecules/charts/bar-list-chart.component'
import { MoneyPipe } from '@angular-app/shared/pipes/money.pipe'
import type { DailyReport } from '@angular-app/features/reports/domain/entities/report.entity'
import {
  buildDailyPoints,
  buildHourlyPoints,
  buildPaymentPoints,
  MAX_DAILY_COLUMNS,
  peakHour,
} from '@angular-app/features/reports/presentation/services/report-charts'

/**
 * Gráficas del resumen de ventas: cómo fueron las ventas en el período, a qué
 * hora se vende más y cómo pagan los clientes. Presentacional.
 */
@Component({
  selector: 'mo-sales-charts',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardComponent, ColumnChartComponent, BarListChartComponent, MoneyPipe],
  template: `
    <div class="grid gap-4 lg:grid-cols-3">
      @if (isRange()) {
        <mo-card class="lg:col-span-2">
          <h3 class="font-display text-sm font-bold">{{ weekly() ? 'Ventas por semana' : 'Ventas por día' }}</h3>
          <p class="text-muted-foreground mb-3 text-xs">
            Cuánto vendiste cada {{ weekly() ? 'semana' : 'día' }} del período. Pasa el dedo o el mouse por una columna para ver el detalle.
          </p>
          <mo-column-chart [points]="dailyPoints()" [ariaLabel]="weekly() ? 'Ventas por semana' : 'Ventas por día'" />
        </mo-card>
      } @else {
        <mo-card class="lg:col-span-2">
          <h3 class="font-display text-sm font-bold">Ventas por hora</h3>
          <p class="text-muted-foreground mb-3 text-xs">Cuánto vendiste en cada hora del día.</p>
          <mo-column-chart [points]="hourlyPoints()" ariaLabel="Ventas por hora" />
        </mo-card>
      }

      <mo-card>
        <h3 class="font-display text-sm font-bold">Cómo te pagaron</h3>
        <p class="text-muted-foreground mb-3 text-xs">Lo recibido por cada método de pago.</p>
        @if (paymentPoints().length > 0) {
          <mo-bar-list-chart [points]="paymentPoints()" [showShare]="true" ariaLabel="Ventas por método de pago" />
        } @else {
          <p class="text-muted-foreground text-sm">Sin ventas en el período.</p>
        }
      </mo-card>

      @if (isRange()) {
        <mo-card class="lg:col-span-3">
          <h3 class="font-display text-sm font-bold">A qué hora se vende más</h3>
          <p class="text-muted-foreground mb-3 text-xs">
            Suma de todas las ventas del período por hora.
            @if (peak(); as p) {
              Tu mejor hora: <span class="text-foreground font-semibold">{{ p.label }}</span> ({{ (p.total | money) }}).
            }
          </p>
          <mo-column-chart [points]="hourlyPoints()" [height]="170" ariaLabel="Ventas por hora del día" />
        </mo-card>
      }
    </div>
  `,
})
export class SalesChartsComponent {
  readonly report = input.required<DailyReport>()
  readonly fromIso = input.required<string>()
  readonly toIso = input.required<string>()

  readonly isRange = computed(() => this.fromIso() !== this.toIso())
  readonly weekly = computed(() => this.dailyPoints().length > 0 && this.spanDays() > MAX_DAILY_COLUMNS)
  private readonly spanDays = computed(
    () => (Date.parse(`${this.toIso()}T00:00:00Z`) - Date.parse(`${this.fromIso()}T00:00:00Z`)) / 86_400_000 + 1,
  )

  readonly dailyPoints = computed(() => buildDailyPoints(this.report().dailySales, this.fromIso(), this.toIso()))
  readonly hourlyPoints = computed(() => buildHourlyPoints(this.report().hourlySales))
  readonly paymentPoints = computed(() => buildPaymentPoints(this.report().paymentBreakdown))
  readonly peak = computed(() => peakHour(this.report().hourlySales))
}
