import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core'
import { formatCurrency } from '@/shared/lib/format'
import { compactMoney, niceTicks } from '@/shared/lib/chart-scale'
import { CHART_SERIES } from './chart-palette'

export interface GroupedSeries {
  name: string
}

export interface GroupedCategory {
  key: string
  label: string
  /** Un valor por serie, en el orden de `series`. */
  values: number[]
}

/**
 * Columnas agrupadas para comparar 2–3 series en el mismo eje (p. ej. ventas
 * vs. gastos por mes). Leyenda siempre visible; tooltip por grupo con todas
 * las series; "Ver como tabla". Colores en orden fijo de la paleta.
 */
@Component({
  selector: 'mo-grouped-column-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-3 flex flex-wrap gap-4 text-xs" aria-hidden="true">
      @for (s of series(); track s.name; let si = $index) {
        <span class="flex items-center gap-1.5">
          <span class="inline-block h-2.5 w-2.5 rounded-sm" [style.background]="colors[si]"></span>
          {{ s.name }}
        </span>
      }
    </div>
    <div class="relative" [style.height.px]="height()">
      <div class="absolute inset-0 bottom-6 left-12" aria-hidden="true">
        @for (tick of ticks(); track tick) {
          <div class="border-border absolute right-0 left-0 border-t" [style.bottom.%]="(tick / top()) * 100">
            <span class="text-muted-foreground absolute -top-2 -left-12 w-11 text-right text-[10px] tabular-nums">
              {{ axis(tick) }}
            </span>
          </div>
        }
      </div>
      <div class="absolute inset-0 bottom-6 left-12 flex items-end" role="list" [attr.aria-label]="ariaLabel()">
        @for (c of categories(); track c.key; let i = $index) {
          <div
            class="relative flex h-full flex-1 items-end justify-center gap-[2px] outline-none"
            role="listitem"
            tabindex="0"
            [attr.aria-label]="describe(c)"
            (pointerenter)="active.set(i)"
            (pointerleave)="active.set(null)"
            (focus)="active.set(i)"
            (blur)="active.set(null)"
          >
            @for (v of c.values; track $index; let si = $index) {
              <div
                class="w-full rounded-t-[4px]"
                [style.maxWidth.px]="20"
                [style.height.%]="v > 0 ? (v / top()) * 100 : 0"
                [style.minHeight.px]="v > 0 ? 2 : 0"
                [style.background]="colors[si]"
                [style.opacity]="active() === null || active() === i ? 1 : 0.55"
              ></div>
            }
            @if (active() === i) {
              <div
                class="bg-card pointer-events-none absolute bottom-full z-10 mb-1 rounded-lg border px-2.5 py-1.5 text-xs whitespace-nowrap shadow-md"
                [class.left-0]="i < categories().length / 3"
                [class.right-0]="i > (categories().length * 2) / 3"
              >
                <p class="text-muted-foreground mb-1 capitalize">{{ c.label }}</p>
                @for (s of series(); track s.name; let si = $index) {
                  <p class="flex items-center gap-2">
                    <span class="inline-block h-0.5 w-3" [style.background]="colors[si]"></span>
                    <span class="font-bold">{{ full(c.values[si] ?? 0) }}</span>
                    <span class="text-muted-foreground">{{ s.name }}</span>
                  </p>
                }
              </div>
            }
          </div>
        }
      </div>
      <div class="absolute right-0 bottom-0 left-12 flex h-5" aria-hidden="true">
        @for (c of categories(); track c.key) {
          <span class="text-muted-foreground flex-1 truncate text-center text-[10px] capitalize">{{ c.label }}</span>
        }
      </div>
    </div>
    @if (showTable()) {
    <details class="mt-2 text-xs">
      <summary class="text-muted-foreground hover:text-foreground cursor-pointer select-none">Ver como tabla</summary>
      <table class="mt-2 w-full">
        <thead>
          <tr class="text-muted-foreground">
            <th class="py-1 text-left font-medium"></th>
            @for (s of series(); track s.name) {
              <th class="py-1 text-right font-medium">{{ s.name }}</th>
            }
          </tr>
        </thead>
        <tbody class="divide-y">
          @for (c of categories(); track c.key) {
            <tr>
              <td class="py-1 capitalize">{{ c.label }}</td>
              @for (v of c.values; track $index) {
                <td class="py-1 text-right font-semibold tabular-nums">{{ full(v) }}</td>
              }
            </tr>
          }
        </tbody>
      </table>
    </details>
    }
  `,
})
export class GroupedColumnChartComponent {
  readonly series = input.required<GroupedSeries[]>()
  readonly categories = input.required<GroupedCategory[]>()
  readonly height = input(200)
  readonly ariaLabel = input('Gráfica de columnas agrupadas')
  /** Desactívalo si la pantalla ya muestra una tabla con estos valores. */
  readonly showTable = input(true)

  readonly colors = CHART_SERIES
  readonly active = signal<number | null>(null)

  readonly ticks = computed(() =>
    niceTicks(Math.max(0, ...this.categories().flatMap((c) => c.values))),
  )
  readonly top = computed(() => this.ticks()[this.ticks().length - 1] || 1)

  axis(v: number): string {
    return compactMoney(v)
  }

  full(v: number): string {
    return formatCurrency(v)
  }

  describe(c: GroupedCategory): string {
    return `${c.label}: ` + this.series().map((s, i) => `${s.name} ${this.full(c.values[i] ?? 0)}`).join(', ')
  }
}
