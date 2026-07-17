import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core'
import { formatCurrency } from '@/shared/lib/format'
import { CardComponent } from '@angular-app/shared/atoms/card.component'
import { MO_TABLE } from '@angular-app/shared/molecules/table/table.directives'
import type { DailyProductSale } from '@angular-app/features/reports/presentation/services/reports.service'

type SortCriterion = 'qty' | 'total'

/**
 * Tabla completa (no top-5) de productos vendidos en el período seleccionado
 * (PLAN-39), ordenable entre "Unidades" y "Facturación" sin recargar datos
 * del servidor. Reemplaza la columna "Top productos" que vivía en
 * `payment-and-top-products.component.ts` (limitada a 5 filas, sin orden).
 *
 * Estado de orden 100% local al componente (`signal`), no vive en
 * `ReportsService`/`DailyReport` — es presentación, no dato del reporte.
 */
@Component({
  selector: 'mo-top-products-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardComponent, MO_TABLE],
  template: `
    <mo-card>
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 class="font-display text-sm font-bold tracking-wide uppercase">Top productos</h3>
        <div class="flex gap-1">
          <button
            type="button"
            (click)="sortBy.set('qty')"
            [class]="sortButtonClass('qty')"
          >
            Unidades
          </button>
          <button
            type="button"
            (click)="sortBy.set('total')"
            [class]="sortButtonClass('total')"
          >
            Facturación
          </button>
        </div>
      </div>

      @if (productSales().length === 0) {
        <p class="text-muted-foreground text-sm">Sin ventas registradas.</p>
      } @else {
        <div class="overflow-x-auto rounded-xl border">
          <table moTable density="compact">
            <thead moThead>
              <tr>
                <th moTh class="text-left">Producto</th>
                <th moTh class="text-right">Ventas</th>
                <th moTh class="text-right">Unidades</th>
                <th moTh class="text-right">Facturación</th>
                <th moTh class="text-right">Precio prom.</th>
              </tr>
            </thead>
            <tbody class="divide-border divide-y">
              @for (p of rows(); track p.productId) {
                <tr>
                  <td moTd class="min-w-40">
                    <p class="font-semibold">{{ p.nombre }}</p>
                    @if (p.sku) {
                      <p class="text-muted-foreground text-xs">SKU {{ p.sku }}</p>
                    }
                  </td>
                  <td moTd class="text-right tabular-nums">{{ p.numVentas }}</td>
                  <td moTd class="text-right tabular-nums">{{ p.qty }}</td>
                  <td moTd class="text-right font-semibold tabular-nums">{{ money(p.total) }}</td>
                  <td moTd class="text-right tabular-nums">{{ money(p.avgPrice) }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </mo-card>
  `,
})
export class TopProductsTableComponent {
  readonly productSales = input.required<DailyProductSale[]>()

  /** Orden por defecto: facturación descendente (igual al orden base del dominio). */
  readonly sortBy = signal<SortCriterion>('total')

  readonly rows = computed<DailyProductSale[]>(() => {
    const criterion = this.sortBy()
    return [...this.productSales()].sort((a, b) => b[criterion] - a[criterion])
  })

  sortButtonClass(criterion: SortCriterion): string {
    return [
      'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
      this.sortBy() === criterion
        ? 'bg-secondary text-secondary-foreground'
        : 'hover:bg-muted text-muted-foreground',
    ].join(' ')
  }

  money(v: number): string {
    return formatCurrency(v)
  }
}
