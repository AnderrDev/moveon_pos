import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core'
import { LowerCasePipe } from '@angular/common'
import type { FinancialSummary } from '@angular-app/features/expenses/domain/services/financial-summary'
import { MoneyPipe } from '@angular-app/shared/pipes/money.pipe'
import { PaymentLabelPipe } from '@angular-app/shared/pipes/payment-label.pipe'
import { ShareBarChartComponent, type ShareSegment } from '@angular-app/shared/molecules/charts/share-bar-chart.component'
import { BarListChartComponent } from '@angular-app/shared/molecules/charts/bar-list-chart.component'
import type { ChartPoint } from '@angular-app/shared/molecules/charts/chart-palette'

/**
 * Resumen del mes en palabras simples (2026-10-24): una frase con lo que se
 * vendió y lo que quedó, una barra que reparte lo vendido (mercancía, gastos,
 * ganancia), tres tarjetas y, a un clic, las cuentas completas y los gastos
 * por categoría. Presentacional — todo entra por input.
 */
@Component({
  selector: 'mo-financial-summary',
  standalone: true,
  imports: [PaymentLabelPipe, MoneyPipe, LowerCasePipe, ShareBarChartComponent, BarListChartComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-card rounded-xl border p-4 sm:p-5">
      <h3 class="text-sm font-semibold">Así va {{ monthLabel() | lowercase }}</h3>
      @if (s().entradasTotales > 0) {
        <p class="mt-1 text-sm leading-relaxed">
          Vendiste <strong>{{ (s().entradasTotales | money) }}</strong>.
          @if (s().costoProductosVendidos !== null) {
            La mercancía que vendiste te había costado
            <strong>{{ (s().costoProductosVendidos! | money) }}</strong>
          } @else {
            No se sabe cuánto te costó la mercancía vendida (faltan costos)
          }
          y en gastos del negocio se fueron <strong>{{ (s().gastosTotal | money) }}</strong>.
          @if (s().utilidadNeta >= 0) {
            Te quedó una ganancia de <strong class="text-emerald-700">{{ (s().utilidadNeta | money) }}</strong>.
          } @else {
            Este mes vas en pérdida: <strong class="text-destructive">{{ (-s().utilidadNeta | money) }}</strong>.
          }
        </p>
        <div class="mt-4">
          <mo-share-bar-chart [segments]="segments()" ariaLabel="A dónde se fue lo que vendiste" />
        </div>
      } @else {
        <p class="text-muted-foreground mt-1 text-sm">Todavía no hay ventas este mes.</p>
      }
    </div>

    <div class="mt-4 grid gap-4 sm:grid-cols-3">
      <div class="bg-card rounded-xl border p-4">
        <p class="text-muted-foreground text-sm font-medium">Vendiste</p>
        <p class="font-display mt-1.5 text-[1.75rem] leading-tight font-extrabold">{{ (s().entradasTotales | money) }}</p>
        <p class="text-muted-foreground mt-1 text-xs">Todo lo cobrado en ventas del mes</p>
      </div>
      <div class="bg-card rounded-xl border p-4">
        <p class="text-muted-foreground text-sm font-medium">{{ s().utilidadNeta >= 0 ? 'Ganancia' : 'Pérdida' }}</p>
        <p
          class="font-display mt-1.5 text-[1.75rem] leading-tight font-extrabold"
          [class.text-emerald-700]="s().utilidadNeta > 0"
          [class.text-destructive]="s().utilidadNeta < 0"
        >
          {{ (abs(s().utilidadNeta) | money) }}
        </p>
        <p class="text-muted-foreground mt-1 text-xs">
          Ventas − lo que costó la mercancía vendida − gastos
          @if (s().margenNeto !== null) {
            · {{ s().margenNeto }}% de lo vendido
          }
        </p>
      </div>
      <div class="bg-card rounded-xl border p-4">
        <p class="text-muted-foreground text-sm font-medium">Plata libre</p>
        <p
          class="font-display mt-1.5 text-[1.75rem] leading-tight font-extrabold"
          [class.text-destructive]="s().dineroLibre < 0"
        >
          {{ (s().dineroLibre | money) }}
        </p>
        <p class="text-muted-foreground mt-1 text-xs">
          Lo que entró menos lo que salió (gastos y compras)@if (s().fijosPendientes > 0) {, y apartando
          {{ (s().fijosPendientes | money) }} de fijos por pagar}.
        </p>
      </div>
    </div>

    @if (s().ventasSinCosto > 0) {
      <p class="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
        {{ s().ventasSinCosto }}
        {{ s().ventasSinCosto === 1 ? 'producto vendido no tiene' : 'productos vendidos no tienen' }}
        costo registrado ({{ s().unidadesSinCosto }} unidades). Su costo no se descuenta, así que la
        ganancia real es algo menor. Regístralo con una entrada de inventario con costo.
      </p>
    }

    @if (gastosPorCategoria().length > 0) {
      <div class="bg-card mt-4 rounded-xl border p-4">
        <h3 class="text-sm font-semibold">En qué se fueron los gastos</h3>
        <p class="text-muted-foreground mb-3 text-xs">Gastos del mes por categoría y su % del total de gastos.</p>
        <mo-bar-list-chart [points]="gastosPorCategoria()" [showShare]="true" ariaLabel="Gastos por categoría" />
      </div>
    }

    <details class="bg-card group mt-4 rounded-xl border p-4">
      <summary class="cursor-pointer text-sm font-semibold select-none">Ver las cuentas completas</summary>
      <dl class="mt-3 space-y-2 text-sm">
        <div class="flex items-center justify-between">
          <dt class="text-muted-foreground">Vendiste</dt>
          <dd class="font-semibold">{{ (s().entradasTotales | money) }}</dd>
        </div>
        @for (payment of s().entradasPorMetodo; track payment.metodo) {
          <div class="flex items-center justify-between pl-3 text-xs">
            <dt class="text-muted-foreground">• En {{ (payment.metodo | paymentLabel) | lowercase }}</dt>
            <dd class="font-semibold">{{ (payment.total | money) }}</dd>
          </div>
        }
        <div class="flex items-center justify-between">
          <dt class="text-muted-foreground">− Lo que costó la mercancía vendida</dt>
          <dd class="font-semibold">
            @if (s().costoProductosVendidos !== null) {
              {{ (s().costoProductosVendidos! | money) }}
            } @else {
              —
            }
          </dd>
        </div>
        <div class="flex items-center justify-between">
          <dt class="text-muted-foreground">− Gastos del negocio</dt>
          <dd class="font-semibold">{{ (s().gastosTotal | money) }}</dd>
        </div>
        <div class="flex items-center justify-between border-t pt-2">
          <dt class="font-semibold">= {{ s().utilidadNeta >= 0 ? 'Ganancia' : 'Pérdida' }}</dt>
          <dd class="font-bold" [class.text-emerald-700]="s().utilidadNeta > 0" [class.text-destructive]="s().utilidadNeta < 0">
            {{ (s().utilidadNeta | money) }}
          </dd>
        </div>
      </dl>

      <h4 class="text-muted-foreground mt-5 text-xs font-semibold">La plata del mes</h4>
      <dl class="mt-2 space-y-2 text-sm">
        <div class="flex items-center justify-between">
          <dt class="text-muted-foreground">Entró por ventas</dt>
          <dd class="font-semibold">{{ (s().entradasTotales | money) }}</dd>
        </div>
        <div class="flex items-center justify-between">
          <dt class="text-muted-foreground">− Salió en gastos</dt>
          <dd class="font-semibold">{{ (s().gastosTotal | money) }}</dd>
        </div>
        <div class="flex items-center justify-between">
          <dt class="text-muted-foreground">− Salió en compras de mercancía</dt>
          <dd class="font-semibold">{{ (s().comprasMercancia | money) }}</dd>
        </div>
        @if (s().fijosPendientes > 0) {
          <div class="flex items-center justify-between">
            <dt class="text-muted-foreground">− Fijos que faltan por pagar (arriendo, nómina…)</dt>
            <dd class="font-semibold">{{ (s().fijosPendientes | money) }}</dd>
          </div>
        }
        <div class="flex items-center justify-between border-t pt-2">
          <dt class="font-semibold">= Plata libre</dt>
          <dd class="font-bold" [class.text-destructive]="s().dineroLibre < 0">{{ (s().dineroLibre | money) }}</dd>
        </div>
      </dl>
      <p class="text-muted-foreground mt-3 text-xs">
        ¿Por qué las compras no restan de la ganancia? Porque la mercancía que compras todavía es tuya:
        su costo se descuenta de la ganancia cuando la vendes.
      </p>
    </details>
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

  abs(n: number): number {
    return Math.abs(n)
  }
}
