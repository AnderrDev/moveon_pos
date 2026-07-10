import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core'
import { formatCurrency } from '@/shared/lib/format'
import { getPaymentMethodLabel } from '@/shared/lib/payment-methods'
import type { FinancialSummary } from '@/modules/expenses/domain/services/financial-summary'

/**
 * Resumen financiero del período: entradas totales, gastos por categoría con
 * su % sobre entradas y utilidad neta. Presentacional — todo entra por input.
 */
@Component({
  selector: 'mo-financial-summary',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid gap-4 sm:grid-cols-3">
      <div class="bg-card rounded-xl border p-4">
        <p class="text-muted-foreground text-xs tracking-wide uppercase">Entradas totales</p>
        <p class="mt-1 text-2xl font-bold">{{ money(s().entradasTotales) }}</p>
        @if (s().entradasPorMetodo.length > 0) {
          <dl class="mt-3 space-y-1.5 border-t pt-2 text-xs">
            @for (payment of s().entradasPorMetodo; track payment.metodo) {
              <div class="flex items-center justify-between gap-3">
                <dt class="text-muted-foreground">{{ paymentLabel(payment.metodo) }}</dt>
                <dd class="font-semibold tabular-nums">
                  {{ money(payment.total) }}
                  @if (payment.pctSobreEntradas !== null) {
                    <span class="text-muted-foreground ml-1">({{ payment.pctSobreEntradas }}%)</span>
                  }
                </dd>
              </div>
            }
          </dl>
        } @else {
          <p class="text-muted-foreground mt-1 text-xs">Ventas completadas del período</p>
        }
      </div>
      <div class="bg-card rounded-xl border p-4">
        <p class="text-muted-foreground text-xs tracking-wide uppercase">Gastos del negocio</p>
        <p class="mt-1 text-2xl font-bold">{{ money(s().gastosTotal) }}</p>
        <p class="text-muted-foreground mt-1 text-xs">
          @if (s().pctGastosSobreEntradas !== null) {
            {{ s().pctGastosSobreEntradas }}% de las entradas
          } @else {
            Sin entradas en el período
          }
        </p>
      </div>
      <div class="bg-card rounded-xl border p-4">
        <p class="text-muted-foreground text-xs tracking-wide uppercase">Utilidad neta</p>
        <p
          class="mt-1 text-2xl font-bold"
          [class.text-emerald-600]="s().utilidadNeta > 0"
          [class.text-destructive]="s().utilidadNeta < 0"
        >
          {{ money(s().utilidadNeta) }}
        </p>
        <p class="text-muted-foreground mt-1 text-xs">
          @if (s().margenNeto !== null) {
            Margen neto: {{ s().margenNeto }}%
          } @else {
            —
          }
        </p>
      </div>
    </div>

    <div class="bg-card mt-4 rounded-xl border p-4">
      <h3 class="text-sm font-semibold">Estado del período</h3>
      <dl class="mt-3 space-y-2 text-sm">
        <div class="flex items-center justify-between">
          <dt class="text-muted-foreground">Entradas totales</dt>
          <dd class="font-semibold">{{ money(s().entradasTotales) }}</dd>
        </div>
        @for (payment of s().entradasPorMetodo; track payment.metodo) {
          <div class="flex items-center justify-between pl-3 text-xs">
            <dt class="text-muted-foreground">• {{ paymentLabel(payment.metodo) }}</dt>
            <dd class="font-semibold">{{ money(payment.total) }}</dd>
          </div>
        }
        <div class="flex items-center justify-between">
          <dt class="text-muted-foreground">− Costo de productos vendidos</dt>
          <dd class="font-semibold">
            @if (s().costoProductosVendidos !== null) {
              {{ money(s().costoProductosVendidos!) }}
            } @else {
              <span class="text-muted-foreground" title="Ningún producto vendido tiene costo capturado">—</span>
            }
          </dd>
        </div>
        @if (s().ventasSinCosto > 0) {
          <p class="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            {{ s().ventasSinCosto }}
            {{ s().ventasSinCosto === 1 ? 'producto vendido' : 'productos vendidos' }}
            sin costo capturado ({{ s().unidadesSinCosto }} unidades): no entran en el costo de
            productos vendidos ni en la utilidad neta.
          </p>
        }
        <div class="flex items-center justify-between">
          <dt class="text-muted-foreground">− Gastos del negocio</dt>
          <dd class="font-semibold">{{ money(s().gastosTotal) }}</dd>
        </div>
        <div class="flex items-center justify-between border-t pt-2">
          <dt class="font-semibold">= Utilidad neta</dt>
          <dd
            class="font-bold"
            [class.text-emerald-600]="s().utilidadNeta > 0"
            [class.text-destructive]="s().utilidadNeta < 0"
          >
            {{ money(s().utilidadNeta) }}
          </dd>
        </div>
      </dl>

      @if (s().porCategoria.length > 0) {
        <h4 class="text-muted-foreground mt-5 text-xs tracking-wide uppercase">
          Gastos por categoría (% sobre entradas)
        </h4>
        <ul class="mt-2 space-y-2">
          @for (cat of s().porCategoria; track cat.categoryId) {
            <li>
              <div class="flex items-center justify-between text-sm">
                <span>{{ cat.nombre }}</span>
                <span class="font-semibold">
                  {{ money(cat.total) }}
                  @if (cat.pctSobreEntradas !== null) {
                    <span class="text-muted-foreground ml-1 text-xs">({{ cat.pctSobreEntradas }}%)</span>
                  }
                </span>
              </div>
              <div class="bg-muted mt-1 h-1.5 overflow-hidden rounded-full">
                <div class="bg-primary h-full rounded-full" [style.width.%]="barWidth(cat.total)"></div>
              </div>
            </li>
          }
        </ul>
      }
    </div>
  `,
})
export class FinancialSummaryComponent {
  readonly s = input.required<FinancialSummary>()

  readonly maxCategoria = computed(() =>
    Math.max(...this.s().porCategoria.map((c) => c.total), 1),
  )

  money(v: number): string {
    return formatCurrency(v)
  }

  paymentLabel(metodo: string): string {
    return getPaymentMethodLabel(metodo)
  }

  barWidth(total: number): number {
    return Math.round((total / this.maxCategoria()) * 100)
  }
}
