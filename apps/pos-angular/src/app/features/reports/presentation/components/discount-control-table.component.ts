import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core'
import { formatCurrency } from '@/shared/lib/format'
import type { DailyReport } from '@angular-app/features/reports/presentation/services/reports.service'

/** Tabla "Control de descuentos": ventas completadas con descuento > 0, por venta/usuario/motivo. */
@Component({
  selector: 'mo-discount-control-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-card rounded-xl border border-amber-500/25 p-5">
      <div class="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 class="font-display text-sm font-bold tracking-wide uppercase">
            Control de descuentos
          </h3>
          <p class="text-muted-foreground mt-1 text-xs">
            Seguimiento por venta, origen y responsable.
          </p>
        </div>
        <div class="flex gap-4 text-right text-xs">
          <div>
            <p class="text-muted-foreground">Por productos</p>
            <p class="font-mono font-bold tabular-nums">{{ money(report().itemDiscountTotal) }}</p>
          </div>
          <div>
            <p class="text-muted-foreground">Globales</p>
            <p class="font-mono font-bold tabular-nums">{{ money(report().globalDiscountTotal) }}</p>
          </div>
        </div>
      </div>
      @if (report().discountedSalesCount === 0) {
        <p class="text-muted-foreground text-sm">No se aplicaron descuentos en este período.</p>
      } @else {
        <div class="overflow-auto">
          <table class="w-full min-w-[760px] text-sm">
            <thead class="text-muted-foreground text-left text-xs uppercase">
              <tr>
                <th class="px-2 py-2">Venta</th>
                <th class="px-2 py-2">Usuario</th>
                <th class="px-2 py-2 text-right">Productos</th>
                <th class="px-2 py-2 text-right">Global</th>
                <th class="px-2 py-2 text-right">Total</th>
                <th class="px-2 py-2 text-right">%</th>
                <th class="px-2 py-2">Motivo</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              @for (sale of discountedSales(); track sale.id) {
                <tr>
                  <td class="px-2 py-2 font-mono text-xs">{{ sale.saleNumber }}</td>
                  <td class="px-2 py-2 text-xs">
                    {{ sale.cashierEmail ?? cashierLabel(sale.cashierId) }}
                  </td>
                  <td class="px-2 py-2 text-right tabular-nums">
                    {{ money(sale.itemDiscountTotal) }}
                  </td>
                  <td class="px-2 py-2 text-right tabular-nums">
                    {{ money(sale.globalDiscountTotal) }}
                  </td>
                  <td class="px-2 py-2 text-right font-bold tabular-nums">
                    {{ money(sale.discountTotal) }}
                  </td>
                  <td class="px-2 py-2 text-right tabular-nums">
                    {{ percent(sale.discountPercentage) }}
                  </td>
                  <td class="max-w-64 px-2 py-2 text-xs">
                    {{ sale.discountReason ?? 'Histórico sin motivo' }}
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
})
export class DiscountControlTableComponent {
  readonly report = input.required<DailyReport>()

  readonly discountedSales = computed(() =>
    this.report().salesDetail.filter(
      (sale) => sale.status === 'completed' && sale.discountTotal > 0,
    ),
  )

  money(v: number): string {
    return formatCurrency(v)
  }

  percent(value: number): string {
    return `${value.toFixed(2)}%`
  }

  cashierLabel(id: string): string {
    return `Cajero ${id.slice(0, 8)}`
  }
}
