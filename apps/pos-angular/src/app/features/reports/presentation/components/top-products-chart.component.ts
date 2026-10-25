import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core'
import { CardComponent } from '@angular-app/shared/atoms/card.component'
import { BarListChartComponent } from '@angular-app/shared/molecules/charts/bar-list-chart.component'
import type { DailyProductSale } from '@angular-app/features/reports/domain/entities/report.entity'
import { buildTopProductPoints } from '@angular-app/features/reports/presentation/services/report-charts'

/** Los 10 productos que más dinero dejaron en el período. Presentacional. */
@Component({
  selector: 'mo-top-products-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardComponent, BarListChartComponent],
  template: `
    <mo-card>
      <h3 class="font-display text-sm font-bold">Los 10 productos que más venden</h3>
      <p class="text-muted-foreground mb-3 text-xs">Por dinero vendido en el período, con el % de tus ventas.</p>
      @if (points().length > 0) {
        <mo-bar-list-chart
          [points]="points()"
          [showShare]="true"
          [shareOf]="totalVentas()"
          ariaLabel="Productos que más venden"
        />
      } @else {
        <p class="text-muted-foreground text-sm">Sin ventas en el período.</p>
      }
    </mo-card>
  `,
})
export class TopProductsChartComponent {
  readonly productSales = input.required<DailyProductSale[]>()
  /** Total vendido del período: base del % de cada producto. */
  readonly totalVentas = input.required<number>()
  readonly points = computed(() => buildTopProductPoints(this.productSales()))
}
