import { ChangeDetectionStrategy, Component, input } from '@angular/core'
import { BadgeComponent } from '../../shared/ui/badge.component'
import { formatCurrency, formatTime } from '@/shared/lib/format'
import { getPaymentMethodLabel } from '@/shared/lib/payment-methods'
import type { Sale } from '@/modules/sales/domain/entities/sale.entity'

/**
 * Tabla de ventas de la sesión activa. Pensada para que el cajero/admin pueda
 * cruzar visualmente las ventas que componen el "Esperado" del cierre, en vez
 * de confiar solo en el agregado por método de pago.
 */
@Component({
  selector: 'mo-turn-sales-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent],
  template: `
    <div class="bg-card flex flex-1 flex-col overflow-hidden rounded-xl border">
      <div class="flex shrink-0 items-center justify-between border-b px-4 py-3">
        <h3 class="font-display text-sm font-bold tracking-wide uppercase">Ventas del turno</h3>
        <mo-badge variant="default">{{ sales().length }}</mo-badge>
      </div>

      @if (sales().length === 0) {
        <p class="text-muted-foreground p-8 text-center text-sm">Sin ventas registradas.</p>
      } @else {
        <div class="overflow-auto">
          <table class="w-full text-sm">
            <thead class="bg-muted/50 text-muted-foreground sticky top-0 text-left text-xs uppercase">
              <tr>
                <th class="px-4 py-2">Hora</th>
                <th class="px-4 py-2"># Venta</th>
                <th class="px-4 py-2">Cajero</th>
                <th class="px-4 py-2">Metodo(s)</th>
                <th class="px-4 py-2 text-right">Total</th>
                <th class="px-4 py-2">Estado</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              @for (sale of sales(); track sale.id) {
                <tr>
                  <td class="text-muted-foreground px-4 py-2 text-xs">{{ time(sale.createdAt) }}</td>
                  <td class="px-4 py-2 font-mono text-xs">{{ sale.saleNumber }}</td>
                  <td class="text-muted-foreground px-4 py-2 text-xs">
                    {{ sale.cashierEmail ?? '—' }}
                  </td>
                  <td class="px-4 py-2">
                    <div class="flex flex-wrap gap-1">
                      @for (payment of sale.payments; track payment.id) {
                        <mo-badge variant="outline">{{ paymentLabel(payment.metodo) }}</mo-badge>
                      }
                    </div>
                  </td>
                  <td
                    class="px-4 py-2 text-right font-semibold tabular-nums"
                    [class.text-destructive]="sale.status === 'voided'"
                  >
                    {{ money(sale.total) }}
                  </td>
                  <td class="px-4 py-2">
                    @if (sale.status === 'voided') {
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
      }
    </div>
  `,
})
export class TurnSalesTableComponent {
  readonly sales = input.required<Sale[]>()

  money(v: number): string {
    return formatCurrency(v)
  }

  time(d: Date): string {
    return formatTime(d)
  }

  paymentLabel(metodo: string): string {
    return getPaymentMethodLabel(metodo)
  }
}
