import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core'
import type { DailyReport } from '@angular-app/features/reports/domain/entities/report.entity'
import { MoneyPipe } from '@angular-app/shared/pipes/money.pipe'
import { MO_TABLE } from '@angular-app/shared/molecules/table/table.directives'

/** Tabla "Control de descuentos": ventas completadas con descuento > 0, por venta/usuario/motivo. */
@Component({
  selector: 'mo-discount-control-table',
  standalone: true,
  imports: [...MO_TABLE, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-card rounded-xl border border-amber-500/25 p-5">
      <div class="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 class="font-display text-sm font-bold">
            Control de descuentos
          </h3>
          <p class="text-muted-foreground mt-1 text-xs">
            Seguimiento por venta, origen y responsable.
          </p>
        </div>
        <div class="flex gap-4 text-right text-xs">
          <div>
            <p class="text-muted-foreground">Por productos</p>
            <p class="font-mono font-bold tabular-nums">{{ (report().itemDiscountTotal | money) }}</p>
          </div>
          <div>
            <p class="text-muted-foreground">Globales</p>
            <p class="font-mono font-bold tabular-nums">{{ (report().globalDiscountTotal | money) }}</p>
          </div>
        </div>
      </div>
      @if (report().discountedSalesCount === 0) {
        <p class="text-muted-foreground text-sm">No se aplicaron descuentos en este período.</p>
      } @else {
        <div class="overflow-auto">
          <table moTable density="compact" class="min-w-[760px]">
            <thead moThead>
              <tr>
                <th moTh class="text-left">Venta</th>
                <th moTh class="text-left">Usuario</th>
                <th moTh class="text-right">Productos</th>
                <th moTh class="text-right">Global</th>
                <th moTh class="text-right">Total</th>
                <th moTh class="text-right">%</th>
                <th moTh class="text-left">Motivo</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              @for (sale of discountedSales(); track sale.id) {
                <tr>
                  <td moTd class="font-mono text-xs">{{ sale.saleNumber }}</td>
                  <td moTd class="text-xs">
                    {{ sale.cashierEmail ?? cashierLabel(sale.cashierId) }}
                  </td>
                  <td moTd class="text-right tabular-nums">
                    {{ (sale.itemDiscountTotal | money) }}
                  </td>
                  <td moTd class="text-right tabular-nums">
                    {{ (sale.globalDiscountTotal | money) }}
                  </td>
                  <td moTd class="text-right font-bold tabular-nums">
                    {{ (sale.discountTotal | money) }}
                  </td>
                  <td moTd class="text-right tabular-nums">
                    {{ percent(sale.discountPercentage) }}
                  </td>
                  <td moTd class="max-w-64 text-xs">
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


  percent(value: number): string {
    return `${value.toFixed(2)}%`
  }

  cashierLabel(id: string): string {
    return `Cajero ${id.slice(0, 8)}`
  }
}
