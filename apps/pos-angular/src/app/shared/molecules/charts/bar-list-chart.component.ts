import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core'
import { formatCurrency } from '@/shared/lib/format'
import { shareLabel } from '@/shared/lib/chart-scale'
import { CHART_PRIMARY, type ChartFormat, type ChartPoint } from './chart-palette'

/**
 * Barras horizontales de una serie, de mayor a menor (top productos, métodos
 * de pago). Cada fila lleva su nombre, el valor en la punta y, si se pide, el
 * % del total: se lee completa sin tooltip. Nombres largos no se cortan en la
 * barra; van arriba.
 */
@Component({
  selector: 'mo-bar-list-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="space-y-2.5" [attr.aria-label]="ariaLabel()">
      @for (p of rows(); track p.key) {
        <li [attr.aria-label]="p.label + ': ' + full(p.value) + (showShare() ? ', ' + share(p.value) + '%' : '')">
          <div class="flex items-baseline justify-between gap-3 text-xs">
            <span class="min-w-0 truncate font-medium" [title]="p.label">{{ p.label }}</span>
            <span class="shrink-0 tabular-nums">
              <span class="font-semibold">{{ full(p.value) }}</span>
              @if (showShare()) {
                <span class="text-muted-foreground ml-1">{{ share(p.value) }}%</span>
              }
            </span>
          </div>
          <div class="bg-muted mt-1 h-2.5 overflow-hidden rounded-full" aria-hidden="true">
            <div
              class="h-full rounded-full"
              [style.width.%]="max() > 0 ? (p.value / max()) * 100 : 0"
              [style.minWidth.px]="p.value > 0 ? 3 : 0"
              [style.background]="color"
            ></div>
          </div>
          @if (p.detail) {
            <p class="text-muted-foreground mt-0.5 text-[11px]">{{ p.detail }}</p>
          }
        </li>
      }
    </ul>
  `,
})
export class BarListChartComponent {
  readonly points = input.required<ChartPoint[]>()
  readonly format = input<ChartFormat>('money')
  /** Muestra el % de cada fila sobre la suma total. */
  readonly showShare = input(false)
  readonly limit = input<number | null>(null)
  /**
   * Base del %. Por defecto, la suma de los puntos; pásala cuando los puntos
   * son solo una parte (p. ej. el top 10 sobre el total vendido).
   */
  readonly shareOf = input<number | null>(null)
  readonly ariaLabel = input('Gráfica de barras')

  readonly color = CHART_PRIMARY

  readonly rows = computed(() => {
    const sorted = [...this.points()].sort((a, b) => b.value - a.value)
    const limit = this.limit()
    return limit ? sorted.slice(0, limit) : sorted
  })
  readonly max = computed(() => Math.max(0, ...this.rows().map((p) => p.value)))
  readonly total = computed(() => this.shareOf() ?? this.points().reduce((s, p) => s + p.value, 0))

  share(v: number): string {
    return shareLabel(v, this.total())
  }

  full(v: number): string {
    return this.format() === 'money' ? formatCurrency(v) : `${Math.round(v).toLocaleString('es-CO')}`
  }
}
