import { DecimalPipe } from '@angular/common'
import { ChangeDetectionStrategy, Component, input } from '@angular/core'
import { formatCurrency } from '@/shared/lib/format'
import type { DailyProductSale } from '@angular-app/features/reports/presentation/services/reports.service'

/**
 * Tabla completa de productos vendidos en el período, con costo/utilidad/margen.
 * El costo es el ACTUAL del producto (no histórico, ver docs/modules/reports.md):
 * filas con costo `null` muestran "—" y quedan fuera de `utilidadTotal`.
 */
@Component({
  selector: 'mo-product-margin-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe],
  template: `
    @if (productSales().length === 0) {
      <p class="text-muted-foreground text-sm">Sin ventas en el período.</p>
    } @else {
      <div class="overflow-auto">
        <table class="w-full text-sm">
          <thead class="text-muted-foreground text-left text-xs uppercase">
            <tr>
              <th class="py-2 pr-4">Producto</th>
              <th class="py-2 pr-4 text-right">Cantidad</th>
              <th class="py-2 pr-4 text-right">Total vendido</th>
              <th class="py-2 pr-4 text-right">Costo</th>
              <th class="py-2 pr-4 text-right">Utilidad</th>
              <th class="py-2 text-right">Margen</th>
            </tr>
          </thead>
          <tbody class="divide-y">
            @for (p of productSales(); track p.productId) {
              <tr>
                <td class="py-2.5 pr-4">
                  <p class="max-w-xs truncate font-semibold">{{ p.nombre }}</p>
                  @if (p.sku) {
                    <p class="text-muted-foreground text-xs">{{ p.sku }}</p>
                  }
                </td>
                <td class="py-2.5 pr-4 text-right tabular-nums">{{ p.qty }}</td>
                <td class="py-2.5 pr-4 text-right font-semibold tabular-nums">
                  {{ money(p.total) }}
                </td>
                <td class="py-2.5 pr-4 text-right tabular-nums">
                  @if (p.costoTotal !== null) {
                    {{ money(p.costoTotal) }}
                  } @else {
                    <span class="text-muted-foreground">—</span>
                  }
                </td>
                <td class="py-2.5 pr-4 text-right font-semibold tabular-nums">
                  @if (p.utilidad !== null) {
                    {{ money(p.utilidad) }}
                  } @else {
                    <span class="text-muted-foreground">—</span>
                  }
                </td>
                <td class="py-2.5 text-right tabular-nums">
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
              <td class="pt-2.5 pr-4 font-black text-xs uppercase" colspan="4">Utilidad total</td>
              <td class="pt-2.5 pr-4 text-right font-bold tabular-nums" colspan="2">
                {{ money(utilidadTotal()) }}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p class="text-muted-foreground mt-3 text-xs">
        Utilidad calculada con el costo actual de cada producto, no el costo al momento de la
        venta. Productos sin costo capturado muestran "—" y no se incluyen en la utilidad total.
      </p>
    }
  `,
})
export class ProductMarginTableComponent {
  readonly productSales = input.required<DailyProductSale[]>()
  readonly utilidadTotal = input.required<number>()

  money(v: number): string {
    return formatCurrency(v)
  }
}
