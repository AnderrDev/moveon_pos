import { ChangeDetectionStrategy, Component, input } from '@angular/core'
import { formatCurrency } from '@/shared/lib/format'
import { getPaymentMethodLabel } from '@/shared/lib/payment-methods'
import { ProductMarginTableComponent } from './product-margin-table.component'
import type { DailyReport } from './reports.service'

/** Contenido del tab "Resumen contable": ingresos, IVA por tasa, pagos para cuadre y utilidad. */
@Component({
  selector: 'mo-accounting-summary',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ProductMarginTableComponent],
  template: `
    <div class="grid gap-4 lg:grid-cols-2">
      <!-- Bloque de ingresos -->
      <div class="bg-card rounded-xl border p-6">
        <h3 class="font-display mb-1 text-sm font-bold tracking-wide uppercase">Ingresos</h3>
        <p class="text-muted-foreground mb-4 text-xs">
          {{ fromIso() === toIso() ? fromIso() : fromIso() + ' al ' + toIso() }}
          · {{ report().countVentas }} ventas completadas
        </p>
        <dl class="space-y-3 text-sm">
          <div class="flex justify-between gap-3">
            <dt class="text-muted-foreground">Ingresos brutos</dt>
            <dd class="font-semibold tabular-nums">{{ money(report().subtotalVentas) }}</dd>
          </div>
          <div class="flex justify-between gap-3 text-amber-800">
            <dt>− Descuentos</dt>
            <dd class="font-semibold tabular-nums">{{ money(report().discountTotal) }}</dd>
          </div>
          <div class="border-border flex justify-between gap-3 border-t pt-3">
            <dt class="font-black">Ingresos netos</dt>
            <dd class="text-primary text-xl font-black tabular-nums">
              {{ money(report().totalVentas) }}
            </dd>
          </div>
          <div class="flex justify-between gap-3 text-xs">
            <dt class="text-muted-foreground">IVA incluido en ingresos netos</dt>
            <dd class="font-semibold tabular-nums">{{ money(report().taxTotal) }}</dd>
          </div>
        </dl>
        @if (report().countAnuladas > 0) {
          <p class="text-muted-foreground mt-4 border-t pt-4 text-xs">
            {{ report().countAnuladas }} venta{{ report().countAnuladas !== 1 ? 's' : '' }} anulada{{
              report().countAnuladas !== 1 ? 's' : ''
            }} (no incluidas en los totales)
          </p>
        }
      </div>

      <!-- Desglose IVA -->
      <div class="bg-card rounded-xl border p-6">
        <h3 class="font-display mb-1 text-sm font-bold tracking-wide uppercase">
          Desglose de IVA
        </h3>
        <p class="text-muted-foreground mb-4 text-xs">
          Por tasa — ventas completadas únicamente
        </p>
        @if (report().taxBreakdown.length === 0) {
          <p class="text-muted-foreground text-sm">Sin ventas en el período.</p>
        } @else {
          <div class="overflow-auto">
            <table class="w-full text-sm">
              <thead class="text-muted-foreground text-left text-xs uppercase">
                <tr>
                  <th class="py-2 pr-4">Tasa</th>
                  <th class="py-2 pr-4 text-right">Base gravable</th>
                  <th class="py-2 pr-4 text-right">IVA generado</th>
                  <th class="py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody class="divide-y">
                @for (row of report().taxBreakdown; track row.taxRate) {
                  <tr>
                    <td class="py-2.5 pr-4 font-bold">
                      @if (row.taxRate === 0) {
                        <span class="text-muted-foreground">Exento</span>
                      } @else {
                        {{ row.taxRate }}%
                      }
                    </td>
                    <td class="py-2.5 pr-4 text-right tabular-nums">
                      {{ money(row.baseAmount) }}
                    </td>
                    <td class="py-2.5 pr-4 text-right font-semibold tabular-nums">
                      @if (row.taxRate === 0) {
                        <span class="text-muted-foreground">—</span>
                      } @else {
                        {{ money(row.taxAmount) }}
                      }
                    </td>
                    <td class="py-2.5 text-right tabular-nums">
                      {{ money(row.baseAmount + row.taxAmount) }}
                    </td>
                  </tr>
                }
              </tbody>
              <tfoot class="border-border border-t">
                <tr>
                  <td class="pt-2.5 pr-4 font-black text-xs uppercase">Total</td>
                  <td class="pt-2.5 pr-4 text-right font-bold tabular-nums">
                    {{ money(report().subtotalVentas) }}
                  </td>
                  <td class="pt-2.5 pr-4 text-right font-bold tabular-nums">
                    {{ money(report().taxTotal) }}
                  </td>
                  <td class="pt-2.5 text-right font-bold tabular-nums">
                    {{ money(report().totalVentas) }}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        }
      </div>

      <!-- Por método de pago (cuadre bancario) -->
      <div class="bg-card rounded-xl border p-6">
        <h3 class="font-display mb-1 text-sm font-bold tracking-wide uppercase">
          Ingresos por método de pago
        </h3>
        <p class="text-muted-foreground mb-4 text-xs">Para cuadre bancario y de caja</p>
        @if (report().paymentBreakdown.length === 0) {
          <p class="text-muted-foreground text-sm">Sin pagos registrados.</p>
        } @else {
          <ul class="space-y-3 text-sm">
            @for (p of report().paymentBreakdown; track p.metodo) {
              <li class="flex items-center justify-between gap-3">
                <div>
                  <p class="font-semibold">{{ paymentLabel(p.metodo) }}</p>
                  <p class="text-muted-foreground text-xs">{{ p.count }} transacciones</p>
                </div>
                <span class="font-mono text-base font-bold tabular-nums">
                  {{ money(p.total) }}
                </span>
              </li>
            }
          </ul>
          <div class="border-border mt-4 flex justify-between border-t pt-3 text-sm">
            <span class="font-black">Total recaudado</span>
            <span class="font-mono font-black tabular-nums">{{ money(report().totalVentas) }}</span>
          </div>
        }
      </div>

      <!-- Productos vendidos con costo, utilidad y margen -->
      <div class="bg-card rounded-xl border p-6 lg:col-span-2">
        <h3 class="font-display mb-1 text-sm font-bold tracking-wide uppercase">
          Productos vendidos y utilidad
        </h3>
        <p class="text-muted-foreground mb-4 text-xs">Ventas completadas del período</p>
        <mo-product-margin-table
          [productSales]="report().productSales"
          [utilidadTotal]="report().utilidadTotal"
        />
      </div>
    </div>
  `,
})
export class AccountingSummaryComponent {
  readonly report = input.required<DailyReport>()
  readonly fromIso = input.required<string>()
  readonly toIso = input.required<string>()

  money(v: number): string {
    return formatCurrency(v)
  }

  paymentLabel(metodo: string): string {
    return getPaymentMethodLabel(metodo)
  }
}
