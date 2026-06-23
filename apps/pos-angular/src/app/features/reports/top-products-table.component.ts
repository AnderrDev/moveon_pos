import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core'
import { formatCurrency } from '@/shared/lib/format'
import type { DailyProductSale } from './reports.service'

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
  template: `
    <div class="bg-card rounded-xl border p-5">
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
          <table class="w-full text-sm">
            <thead class="bg-muted/50 text-muted-foreground text-xs uppercase">
              <tr>
                <th class="px-3 py-2 text-left font-bold">Producto</th>
                <th class="px-3 py-2 text-right font-bold">Ventas</th>
                <th class="px-3 py-2 text-right font-bold">Unidades</th>
                <th class="px-3 py-2 text-right font-bold">Facturación</th>
                <th class="px-3 py-2 text-right font-bold">Precio prom.</th>
              </tr>
            </thead>
            <tbody class="divide-border divide-y">
              @for (p of rows(); track p.productId) {
                <tr>
                  <td class="min-w-40 px-3 py-2">
                    <p class="font-semibold">{{ p.nombre }}</p>
                    @if (p.sku) {
                      <p class="text-muted-foreground text-xs">SKU {{ p.sku }}</p>
                    }
                  </td>
                  <td class="px-3 py-2 text-right tabular-nums">{{ p.numVentas }}</td>
                  <td class="px-3 py-2 text-right tabular-nums">{{ p.qty }}</td>
                  <td class="px-3 py-2 text-right font-semibold tabular-nums">
                    {{ money(p.total) }}
                  </td>
                  <td class="px-3 py-2 text-right tabular-nums">{{ money(p.avgPrice) }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
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
