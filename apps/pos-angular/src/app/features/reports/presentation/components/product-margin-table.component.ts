import { DecimalPipe } from '@angular/common'
import { ChangeDetectionStrategy, Component, input } from '@angular/core'
import type { DailyProductSale } from '@angular-app/features/reports/domain/entities/report.entity'
import { MoneyPipe } from '@angular-app/shared/pipes/money.pipe'
import { MO_TABLE } from '@angular-app/shared/molecules/table/table.directives'

/**
 * Tabla completa de productos vendidos en el período, con costo/utilidad/margen.
 * El costo es el ACTUAL del producto (no histórico, ver docs/modules/reports.md):
 * filas con costo `null` muestran "—" y quedan fuera de `utilidadTotal`.
 */
@Component({
  selector: 'mo-product-margin-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...MO_TABLE, MoneyPipe, DecimalPipe],
  template: `
    @if (productSales().length === 0) {
      <p class="text-muted-foreground text-sm">Sin ventas en el período.</p>
    } @else {
      <div class="overflow-auto">
        <table moTable density="compact">
          <thead moThead>
            <tr>
              <th moTh class="text-left">Producto</th>
              <th moTh class="text-right">Cantidad</th>
              <th moTh class="text-right">Total vendido</th>
              <th moTh class="text-right">Costo</th>
              <th moTh class="text-right">Utilidad</th>
              <th moTh class="text-right">Margen</th>
            </tr>
          </thead>
          <tbody class="divide-y">
            @for (p of productSales(); track p.productId) {
              <tr>
                <td moTd>
                  <p class="max-w-xs truncate font-semibold">{{ p.nombre }}</p>
                  @if (p.sku) {
                    <p class="text-muted-foreground text-xs">{{ p.sku }}</p>
                  }
                </td>
                <td moTd class="text-right tabular-nums">{{ p.qty }}</td>
                <td moTd class="text-right font-semibold tabular-nums">
                  {{ (p.total | money) }}
                </td>
                <td moTd class="text-right tabular-nums">
                  @if (p.costoTotal !== null) {
                    {{ (p.costoTotal | money) }}
                  } @else {
                    <span class="text-muted-foreground">—</span>
                  }
                </td>
                <td moTd class="text-right font-semibold tabular-nums">
                  @if (p.utilidad !== null) {
                    {{ (p.utilidad | money) }}
                  } @else {
                    <span class="text-muted-foreground">—</span>
                  }
                </td>
                <td moTd class="text-right tabular-nums">
                  @if (p.margenPct !== null) {
                    {{ p.margenPct | number: '1.0-1' }}%
                  } @else {
                    <span class="text-muted-foreground">—</span>
                  }
                </td>
              </tr>
            }
          </tbody>
          <tfoot class="border-border border-t">
            <tr>
              <td moTd class="font-black text-xs uppercase" colspan="4">Utilidad total</td>
              <td moTd class="text-right font-bold tabular-nums" colspan="2">
                {{ (utilidadTotal() | money) }}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p class="text-muted-foreground mt-3 text-xs">
        Utilidad calculada con el costo que tenía el producto al momento de cada venta. Los
        productos vendidos sin costo capturado muestran "—" y no se incluyen en la utilidad total.
      </p>
    }
  `,
})
export class ProductMarginTableComponent {
  readonly productSales = input.required<DailyProductSale[]>()
  readonly utilidadTotal = input.required<number>()

}
