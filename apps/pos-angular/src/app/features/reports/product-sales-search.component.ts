import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core'
import { BadgeComponent } from '../../shared/atoms/badge.component'
import { formatCurrency, formatShortDate, formatTime } from '@/shared/lib/format'
import type { DailySaleItemDetail } from './reports.service'

/**
 * Buscador de producto dentro del período seleccionado: filtra `saleItems`
 * (ya cargado por `ReportesPage`, sin queries nuevas) por nombre o SKU y
 * muestra cada movimiento de venta donde aparece (fecha, venta, cajero,
 * cantidad, total, estado).
 */
@Component({
  selector: 'mo-product-sales-search',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent],
  template: `
    <div>
      <h3 class="font-display mb-3 text-sm font-bold tracking-wide uppercase">
        Buscar producto
      </h3>
      <input
        type="search"
        [value]="query()"
        (input)="onQueryInput($event)"
        placeholder="Buscar por nombre o SKU..."
        class="border-input bg-card focus:ring-ring mb-3 h-10 w-full rounded-lg border px-3 text-sm focus:ring-2 focus:outline-none sm:max-w-sm"
      />
      @if (query().trim() === '') {
        <p class="text-muted-foreground text-sm">
          Escribe el nombre o SKU de un producto para ver en qué ventas del período aparece.
        </p>
      } @else if (rows().length === 0) {
        <p class="text-muted-foreground text-sm">
          Sin movimientos de "{{ query() }}" en el período seleccionado.
        </p>
      } @else {
        <div class="overflow-x-auto rounded-xl border">
          <table class="w-full text-sm">
            <thead class="bg-muted/50 text-muted-foreground text-xs uppercase">
              <tr>
                <th class="px-3 py-2 text-left font-bold">Fecha</th>
                <th class="px-3 py-2 text-left font-bold">Venta</th>
                <th class="px-3 py-2 text-left font-bold">Producto</th>
                <th class="px-3 py-2 text-right font-bold">Cant.</th>
                <th class="px-3 py-2 text-right font-bold">Total</th>
                <th class="px-3 py-2 text-left font-bold">Cajero</th>
                <th class="px-3 py-2 text-left font-bold">Estado</th>
              </tr>
            </thead>
            <tbody class="divide-border divide-y">
              @for (row of rows(); track $index) {
                <tr [class.opacity-60]="row.status === 'voided'">
                  <td class="text-muted-foreground px-3 py-2 whitespace-nowrap">
                    {{ date(row.createdAt) }} · {{ time(row.createdAt) }}
                  </td>
                  <td class="px-3 py-2 font-mono font-semibold whitespace-nowrap">
                    {{ row.saleNumber }}
                  </td>
                  <td class="min-w-40 px-3 py-2">
                    <p class="font-semibold">{{ row.productName }}</p>
                    @if (row.productSku) {
                      <p class="text-muted-foreground text-xs">SKU {{ row.productSku }}</p>
                    }
                  </td>
                  <td class="px-3 py-2 text-right tabular-nums">{{ row.quantity }}</td>
                  <td class="px-3 py-2 text-right font-semibold tabular-nums">
                    {{ money(row.total) }}
                  </td>
                  <td class="text-muted-foreground px-3 py-2">
                    {{ row.cashierEmail || 'Sin registrar' }}
                  </td>
                  <td class="px-3 py-2">
                    @if (row.status === 'voided') {
                      <mo-badge variant="destructive">Anulada</mo-badge>
                    } @else {
                      <mo-badge variant="success">Completada</mo-badge>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <p class="text-muted-foreground mt-2 text-xs">
          {{ rows().length }} {{ rows().length === 1 ? 'movimiento' : 'movimientos' }} ·
          {{ totalQty() }} unidades · {{ money(totalAmount()) }}
        </p>
      }
    </div>
  `,
})
export class ProductSalesSearchComponent {
  readonly saleItems = input.required<DailySaleItemDetail[]>()

  readonly query = signal('')

  readonly rows = computed<DailySaleItemDetail[]>(() => {
    const q = this.query().trim().toLowerCase()
    if (q === '') return []
    return this.saleItems()
      .filter(
        (item) =>
          item.productName.toLowerCase().includes(q) ||
          (item.productSku?.toLowerCase().includes(q) ?? false),
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  })

  readonly totalQty = computed(() =>
    this.rows().reduce((sum, row) => (row.status === 'voided' ? sum : sum + row.quantity), 0),
  )

  readonly totalAmount = computed(() =>
    this.rows().reduce((sum, row) => (row.status === 'voided' ? sum : sum + row.total), 0),
  )

  onQueryInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value)
  }

  money(v: number): string {
    return formatCurrency(v)
  }

  date(d: Date): string {
    return formatShortDate(d)
  }

  time(d: Date): string {
    return formatTime(d)
  }
}
