import { ChangeDetectionStrategy, Component, input } from '@angular/core'
import { formatCurrency } from '@/shared/lib/format'
import type { DailyReport } from './reports.service'

/** Las 5 tarjetas KPI del tab "Ventas": total, descuentos, ticket promedio, IVA, anuladas. */
@Component({
  selector: 'mo-daily-kpi-cards',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <div class="bg-card rounded-xl border p-5">
        <p class="text-muted-foreground text-xs font-semibold uppercase">Total ventas</p>
        <p class="font-display mt-2 text-2xl font-bold tabular-nums">
          {{ money(report().totalVentas) }}
        </p>
        <p class="text-muted-foreground text-xs">{{ report().countVentas }} ventas</p>
      </div>
      <div class="rounded-xl border border-amber-500/30 bg-amber-500/8 p-5">
        <p class="text-xs font-semibold text-amber-800 uppercase">Descuentos</p>
        <p class="font-display mt-2 text-2xl font-bold tabular-nums">
          {{ money(report().discountTotal) }}
        </p>
        <p class="text-muted-foreground text-xs">
          {{ report().discountedSalesCount }} ventas · promedio
          {{ percent(report().averageDiscountPercentage) }}
        </p>
      </div>
      <div class="bg-card rounded-xl border p-5">
        <p class="text-muted-foreground text-xs font-semibold uppercase">Ticket promedio</p>
        <p class="font-display mt-2 text-2xl font-bold tabular-nums">
          {{ money(report().avgVenta) }}
        </p>
      </div>
      <div class="bg-card rounded-xl border p-5">
        <p class="text-muted-foreground text-xs font-semibold uppercase">IVA</p>
        <p class="font-display mt-2 text-2xl font-bold tabular-nums">
          {{ money(report().taxTotal) }}
        </p>
      </div>
      <div class="bg-card rounded-xl border p-5">
        <p class="text-muted-foreground text-xs font-semibold uppercase">Anuladas</p>
        <p class="font-display mt-2 text-2xl font-bold tabular-nums">{{ report().countAnuladas }}</p>
      </div>
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
}
