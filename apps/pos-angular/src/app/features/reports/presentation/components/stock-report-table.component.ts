import { ChangeDetectionStrategy, Component, input } from '@angular/core'
import { BadgeComponent } from '@angular-app/shared/atoms/badge.component'
import { EmptyStateComponent } from '@angular-app/shared/molecules/empty-state.component'
import { TableShellComponent } from '@angular-app/shared/molecules/table/table-shell.component'
import type { StockReportRow } from '@angular-app/features/reports/presentation/services/reports.service'

/** Tabla del tab "Stock": punto de venta / bodega / total / mínimo, con badge de stock bajo. */
@Component({
  selector: 'mo-stock-report-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent, EmptyStateComponent, TableShellComponent],
  template: `
    @if (rows().length === 0) {
      <mo-empty-state title="Sin productos" description="Crea productos para ver el reporte." />
    } @else {
      <mo-table-shell class="flex-1">
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
              <tr [class.bg-red-50]="row.isOut" [class.bg-amber-50]="row.isLow && !row.isOut">
                <td class="px-4 py-3 font-semibold">{{ row.nombre }}</td>
                <td class="text-muted-foreground px-4 py-3 font-mono text-xs">
                  {{ row.sku ?? '—' }}
                </td>
                <td
                  class="px-4 py-3 text-right font-bold tabular-nums"
                  [class.text-destructive]="row.isOut"
                >
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
                  @if (row.isOut) {
                    <mo-badge variant="destructive">Agotado</mo-badge>
                  } @else if (row.isLow) {
                    <mo-badge variant="warning">Stock bajo</mo-badge>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </mo-table-shell>
    }
  `,
})
export class StockReportTableComponent {
  readonly rows = input.required<StockReportRow[]>()
}
