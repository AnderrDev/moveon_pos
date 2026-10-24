import { ChangeDetectionStrategy, Component, input } from '@angular/core'
import { ProductMarginTableComponent } from '@angular-app/features/reports/presentation/components/product-margin-table.component'
import type { DailyReport } from '@angular-app/features/reports/domain/entities/report.entity'
import { MoneyPipe } from '@angular-app/shared/pipes/money.pipe'
import { PaymentLabelPipe } from '@angular-app/shared/pipes/payment-label.pipe'

/** Contenido del tab "Resumen contable": ingresos, IVA por tasa, pagos para cuadre y utilidad. */
@Component({
  selector: 'mo-accounting-summary',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PaymentLabelPipe, MoneyPipe, ProductMarginTableComponent],
  template: `
    <div class="grid gap-4 lg:grid-cols-2">
      <!-- Bloque de ingresos -->
      <div class="bg-card rounded-xl border p-6">
        <h3 class="font-display mb-1 text-sm font-bold">Ingresos</h3>
        <p class="text-muted-foreground mb-4 text-xs">
          {{ fromIso() === toIso() ? fromIso() : fromIso() + ' al ' + toIso() }}
          · {{ report().countVentas }} ventas completadas
        </p>
        <dl class="space-y-3 text-sm">
          <div class="flex justify-between gap-3">
            <dt class="text-muted-foreground">Ingresos brutos</dt>
            <dd class="font-semibold tabular-nums">{{ (report().subtotalVentas | money) }}</dd>
          </div>
          <div class="flex justify-between gap-3 text-amber-800">
            <dt>− Descuentos</dt>
            <dd class="font-semibold tabular-nums">{{ (report().discountTotal | money) }}</dd>
          </div>
          <div class="border-border flex justify-between gap-3 border-t pt-3">
            <dt class="font-black">Ingresos netos</dt>
            <dd class="text-foreground text-xl font-black tabular-nums">
              {{ (report().totalVentas | money) }}
            </dd>
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

      <!-- Por método de pago (cuadre bancario) -->
      <div class="bg-card rounded-xl border p-6">
        <h3 class="font-display mb-1 text-sm font-bold">
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
                  <p class="font-semibold">{{ (p.metodo | paymentLabel) }}</p>
                  <p class="text-muted-foreground text-xs">{{ p.count }} transacciones</p>
                </div>
                <span class="font-mono text-base font-bold tabular-nums">
                  {{ (p.total | money) }}
                </span>
              </li>
            }
          </ul>
          <div class="border-border mt-4 flex justify-between border-t pt-3 text-sm">
            <span class="font-black">Total recaudado</span>
            <span class="font-mono font-black tabular-nums">{{ (report().totalVentas | money) }}</span>
          </div>
        }
      </div>

      <!-- Productos vendidos con costo, utilidad y margen -->
      <div class="bg-card rounded-xl border p-6 lg:col-span-2">
        <h3 class="font-display mb-1 text-sm font-bold">
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


}
