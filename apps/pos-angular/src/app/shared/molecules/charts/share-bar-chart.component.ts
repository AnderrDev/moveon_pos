import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core'
import { formatCurrency } from '@/shared/lib/format'
import { shareLabel } from '@/shared/lib/chart-scale'
import { CHART_SERIES } from './chart-palette'

export interface ShareSegment {
  key: string
  label: string
  value: number
  /** Explicación corta bajo el nombre en la leyenda. */
  hint?: string
}

/**
 * Una barra que reparte un total en 2–3 partes (p. ej. a dónde se fue lo
 * vendido: mercancía, gastos, ganancia). Segmentos separados por 2px, leyenda
 * con valor y % siempre visible (el verde no llega a 3:1 de contraste, así que
 * nunca depende solo del color). Valores ≤ 0 no se dibujan.
 */
@Component({
  selector: 'mo-share-bar-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex h-4 gap-[2px] overflow-hidden rounded-full" role="img" [attr.aria-label]="description()">
      @for (s of visible(); track s.key) {
        <div
          class="h-full first:rounded-l-full last:rounded-r-full"
          [style.flexGrow]="s.value"
          [style.flexBasis.px]="0"
          [style.minWidth.px]="4"
          [style.background]="colorOf(s.key)"
          [title]="s.label + ': ' + full(s.value)"
        ></div>
      }
    </div>
    <ul class="mt-3 grid gap-3 sm:grid-cols-3">
      @for (s of segments(); track s.key) {
        <li class="flex gap-2">
          <span class="mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-sm" [style.background]="colorOf(s.key)" aria-hidden="true"></span>
          <div class="min-w-0">
            <p class="text-sm font-semibold">{{ s.label }}</p>
            <p class="text-base font-bold tabular-nums">
              {{ full(s.value) }}
              @if (total() > 0) {
                <span class="text-muted-foreground text-xs font-medium">{{ share(s.value) }}%</span>
              }
            </p>
            @if (s.hint) {
              <p class="text-muted-foreground text-xs">{{ s.hint }}</p>
            }
          </div>
        </li>
      }
    </ul>
  `,
})
export class ShareBarChartComponent {
  readonly segments = input.required<ShareSegment[]>()
  readonly ariaLabel = input('Reparto del total')

  readonly visible = computed(() => this.segments().filter((s) => s.value > 0))
  readonly total = computed(() => this.visible().reduce((sum, s) => sum + s.value, 0))
  readonly description = computed(
    () => `${this.ariaLabel()}: ` + this.segments().map((s) => `${s.label} ${this.full(s.value)}`).join(', '),
  )

  /** El color sigue al segmento por su posición en `segments`, no por cuáles se ven. */
  colorOf(key: string): string {
    const index = this.segments().findIndex((s) => s.key === key)
    return CHART_SERIES[Math.max(0, index) % CHART_SERIES.length]
  }

  share(v: number): string {
    return shareLabel(Math.max(v, 0), this.total())
  }

  full(v: number): string {
    return formatCurrency(v)
  }
}
