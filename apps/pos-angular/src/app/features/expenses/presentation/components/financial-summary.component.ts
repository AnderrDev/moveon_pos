import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core'
import { LowerCasePipe } from '@angular/common'
import type { FinancialSummary } from '@angular-app/features/expenses/domain/services/financial-summary'
import { MoneyPipe } from '@angular-app/shared/pipes/money.pipe'
import { PaymentLabelPipe } from '@angular-app/shared/pipes/payment-label.pipe'
import { ShareBarChartComponent, type ShareSegment } from '@angular-app/shared/molecules/charts/share-bar-chart.component'
import { BarListChartComponent } from '@angular-app/shared/molecules/charts/bar-list-chart.component'
import { StatCardComponent } from '@angular-app/shared/molecules/stat-card.component'
import type { ChartPoint } from '@angular-app/shared/molecules/charts/chart-palette'

/**
 * Resumen del mes con un solo resultado (2026-10-26): ventas − costo de lo
 * vendido − gastos = ganancia, una barra que reparte lo vendido, avisos (fijos
 * por pagar, productos sin costo), el cobro por método a un clic y los gastos
 * por categoría. Presentacional — todo entra por input.
 */
@Component({
  selector: 'mo-financial-summary',
  standalone: true,
  imports: [PaymentLabelPipe, MoneyPipe, LowerCasePipe, ShareBarChartComponent, BarListChartComponent, StatCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-card rounded-xl border p-4 sm:p-5">
      <h3 class="text-sm font-semibold">Así va {{ monthLabel() | lowercase }}</h3>
      <p class="text-muted-foreground mt-1 text-xs">
        Ganancia = lo que vendiste − lo que te costó esa mercancía − los gastos del negocio.
      </p>

      <div class="mt-4 grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
        <mo-stat-card label="Vendiste" [value]="(s().entradasTotales | money)" />
        <mo-stat-card
          label="− Costo de lo vendido"
          [value]="s().costoProductosVendidos !== null ? (s().costoProductosVendidos! | money) : '—'"
          hint="Lo que te costó la mercancía que vendiste"
        />
        <mo-stat-card label="− Gastos" [value]="(s().gastosTotal | money)" hint="Arriendo, nómina, caja…" />
        <mo-stat-card
          [label]="s().utilidadNeta >= 0 ? '= Ganancia' : '= Pérdida'"
          [value]="(s().utilidadNeta | money)"
          [hint]="s().margenNeto !== null ? s().margenNeto + '% de lo vendido' : null"
          [tone]="s().utilidadNeta > 0 ? 'success' : s().utilidadNeta < 0 ? 'warning' : 'default'"
        />
      </div>

      @if (s().entradasTotales > 0) {
        <div class="mt-4">
          <mo-share-bar-chart [segments]="segments()" ariaLabel="A dónde se fue lo que vendiste" />
        </div>
      } @else {
        <p class="text-muted-foreground mt-3 text-sm">Todavía no hay ventas este mes.</p>
      }

      @if (s().fijosPendientes > 0) {
        <p class="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Aún faltan <strong>{{ (s().fijosPendientes | money) }}</strong> de gastos fijos por pagar este mes
          (arriendo, nómina…). Cuando los pagues, la ganancia quedará en
          <strong>{{ (s().utilidadTrasFijos | money) }}</strong>.
        </p>
      }

      @if (s().ventasSinCosto > 0) {
        <p class="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {{ s().ventasSinCosto }}
          {{ s().ventasSinCosto === 1 ? 'producto vendido no tiene' : 'productos vendidos no tienen' }}
          costo registrado ({{ s().unidadesSinCosto }} unidades). Su costo no se descuenta, así que la
          ganancia real es algo menor. Regístralo con una entrada de inventario con costo.
        </p>
      }

      @if (s().entradasPorMetodo.length > 0) {
        <details class="mt-3 text-xs">
          <summary class="text-muted-foreground hover:text-foreground cursor-pointer select-none">
            Ver cómo te pagaron
          </summary>
          <dl class="mt-2 space-y-1.5">
            @for (payment of s().entradasPorMetodo; track payment.metodo) {
              <div class="flex items-center justify-between">
                <dt class="text-muted-foreground">{{ payment.metodo | paymentLabel }}</dt>
                <dd class="font-semibold tabular-nums">{{ (payment.total | money) }}</dd>
              </div>
            }
          </dl>
        </details>
      }
      <p class="text-muted-foreground mt-3 text-xs">
        Las compras de mercancía no restan aquí: esa mercancía sigue siendo tuya y su costo se descuenta
        cuando la vendes. Lo que llevas invertido en mercancía está en el fondo de reinversión.
      </p>
    </div>

    @if (gastosPorCategoria().length > 0) {
      <div class="bg-card mt-4 rounded-xl border p-4">
        <h3 class="text-sm font-semibold">En qué se fueron los gastos</h3>
        <p class="text-muted-foreground mb-3 text-xs">Gastos del mes por categoría y su % del total de gastos.</p>
        <mo-bar-list-chart [points]="gastosPorCategoria()" [showShare]="true" ariaLabel="Gastos por categoría" />
      </div>
    }
  `,
})
export class FinancialSummaryComponent {
  readonly s = input.required<FinancialSummary>()
  /** "octubre de 2026" */
  readonly monthLabel = input('el mes')

  readonly segments = computed<ShareSegment[]>(() => {
    const s = this.s()
    return [
      { key: 'mercancia', label: 'Mercancía vendida', value: s.costoProductosVendidos ?? 0, hint: 'Lo que te costó lo que vendiste' },
      { key: 'gastos', label: 'Gastos', value: s.gastosTotal, hint: 'Arriendo, nómina, insumos…' },
      { key: 'ganancia', label: 'Ganancia', value: Math.max(s.utilidadNeta, 0), hint: 'Lo que te quedó' },
    ]
  })

  readonly gastosPorCategoria = computed<ChartPoint[]>(() =>
    this.s().porCategoria.map((c) => ({ key: c.categoryId, label: c.nombre, value: c.total })),
  )
}
