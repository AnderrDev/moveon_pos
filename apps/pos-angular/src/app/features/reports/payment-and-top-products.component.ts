import { ChangeDetectionStrategy, Component, input } from '@angular/core'
import { formatCurrency } from '@/shared/lib/format'
import { getPaymentMethodLabel } from '@/shared/lib/payment-methods'
import type { DailyPaymentBreakdown } from './reports.service'

/**
 * Bloque "Por método de pago" (tab Ventas). El bloque "Top productos" que
 * vivía aquí se extrajo a `top-products-table.component.ts` (PLAN-39): se
 * convirtió en una tabla completa ordenable, que ya no encajaba como columna
 * resumen de 5 filas junto a este bloque.
 */
@Component({
  selector: 'mo-payment-and-top-products',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-card rounded-xl border p-5">
      <h3 class="font-display mb-3 text-sm font-bold tracking-wide uppercase">
        Por método de pago
      </h3>
      @if (paymentBreakdown().length === 0) {
        <p class="text-muted-foreground text-sm">Sin pagos registrados.</p>
      } @else {
        <ul class="space-y-2 text-sm">
          @for (p of paymentBreakdown(); track p.metodo) {
            <li class="flex justify-between">
              <span>{{ paymentLabel(p.metodo) }} ({{ p.count }})</span>
              <span class="font-mono font-semibold tabular-nums">{{ money(p.total) }}</span>
            </li>
          }
        </ul>
      }
    </div>
  `,
})
export class PaymentAndTopProductsComponent {
  readonly paymentBreakdown = input.required<DailyPaymentBreakdown[]>()

  money(v: number): string {
    return formatCurrency(v)
  }

  paymentLabel(metodo: string): string {
    return getPaymentMethodLabel(metodo)
  }
}
