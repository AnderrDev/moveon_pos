import { ChangeDetectionStrategy, Component, input } from '@angular/core'
import { BadgeComponent } from '../../shared/ui/badge.component'
import { EmptyStateComponent } from '../../shared/feedback/empty-state.component'
import type { StockReportRow } from './reports.service'

/** Tabla del tab "Stock": punto de venta / bodega / total / mínimo, con badge de stock bajo. */
@Component({
  selector: 'mo-stock-report-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent, EmptyStateComponent],
  template: `
    @if (rows().length === 0) {
      <mo-empty-state title="Sin productos" description="Crea productos para ver el reporte." />
    } @else {
      <div class="bg-card flex-1 overflow-auto rounded-xl border">
        <table class="w-full text-sm">
          <thead
            class="bg-muted/50 text-muted-foreground sticky top-0 text-left text-xs uppercase"
          >
            <tr>
              <th class="px-4 py-3">Producto</th>
              <th class="px-4 py-3">SKU</th>
              <th class="px-4 py-3 text-right">Punto venta</th>
              <th class="px-4 py-3 text-right">Bodega</th>
              <th class="px-4 py-3 text-right">Total</th>
              <th class="px-4 py-3 text-right">Min</th>
              <th class="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody class="divide-y">
            @for (row of rows(); track row.productId) {
              <tr [class.bg-amber-50]="row.isLow">
                <td class="px-4 py-3 font-semibold">{{ row.nombre }}</td>
                <td class="text-muted-foreground px-4 py-3 font-mono text-xs">
                  {{ row.sku ?? '—' }}
                </td>
                <td class="px-4 py-3 text-right font-bold tabular-nums">
                  {{ row.puntoVentaStock }}
                </td>
                <td class="px-4 py-3 text-right font-semibold tabular-nums">
                  {{ row.bodegaStock }}
                </td>
                <td class="text-muted-foreground px-4 py-3 text-right tabular-nums">
                  {{ row.totalStock }}
                </td>
                <td class="text-muted-foreground px-4 py-3 text-right tabular-nums">
                  {{ row.minimumStock }}
                </td>
                <td class="px-4 py-3">
                  @if (row.isLow) {
                    <mo-badge variant="warning">Stock bajo</mo-badge>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
})
export class StockReportTableComponent {
  readonly rows = input.required<StockReportRow[]>()
}
