import { ChangeDetectionStrategy, Component, input } from '@angular/core'
import { BadgeComponent } from '@angular-app/shared/atoms/badge.component'
import { EmptyStateComponent } from '@angular-app/shared/molecules/empty-state.component'
import { TableShellComponent } from '@angular-app/shared/molecules/table/table-shell.component'
import type { StockReportRow } from '@angular-app/features/reports/domain/entities/report.entity'
import { MO_TABLE } from '@angular-app/shared/molecules/table/table.directives'

/** Tabla del tab "Stock": punto de venta / bodega / total / mínimo, con badge de stock bajo. */
@Component({
  selector: 'mo-stock-report-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...MO_TABLE, BadgeComponent, EmptyStateComponent, TableShellComponent],
  template: `
    @if (rows().length === 0) {
      <mo-empty-state title="Sin productos" description="Crea productos para ver el reporte." />
    } @else {
      <mo-table-shell class="flex-1">
        <table moTable>
          <thead moThead>
            <tr>
              <th moTh class="text-left">Producto</th>
              <th moTh class="text-left">SKU</th>
              <th moTh class="text-right">Punto venta</th>
              <th moTh class="text-right">Bodega</th>
              <th moTh class="text-right">Total</th>
              <th moTh class="text-right">Min</th>
              <th moTh class="text-left"></th>
            </tr>
          </thead>
          <tbody class="divide-y">
            @for (row of rows(); track row.productId) {
              <tr [class.bg-red-50]="row.isOut" [class.bg-amber-50]="row.isLow && !row.isOut">
                <td moTd class="font-semibold">{{ row.nombre }}</td>
                <td moTd class="text-muted-foreground font-mono text-xs">
                  {{ row.sku ?? '—' }}
                </td>
                <td moTd class="text-right font-bold tabular-nums"
                  [class.text-destructive]="row.isOut"
                >
                  {{ row.puntoVentaStock }}
                </td>
                <td moTd class="text-right font-semibold tabular-nums">
                  {{ row.bodegaStock }}
                </td>
                <td moTd class="text-muted-foreground text-right tabular-nums">
                  {{ row.totalStock }}
                </td>
                <td moTd class="text-muted-foreground text-right tabular-nums">
                  {{ row.minimumStock }}
                </td>
                <td moTd>
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
