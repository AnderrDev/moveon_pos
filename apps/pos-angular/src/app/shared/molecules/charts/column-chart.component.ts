import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core'
import { formatCurrency } from '@/shared/lib/format'
import { compactCount, compactMoney, niceTicks } from '@/shared/lib/chart-scale'
import { CHART_PRIMARY, type ChartFormat, type ChartPoint } from './chart-palette'

/**
 * Columnas de una sola serie (ventas por día, por hora...). Eje con números
 * redondos, columnas finas con punta redondeada, tooltip por columna al pasar
 * el mouse o con el teclado, y "Ver como tabla" para leer cada valor sin el
 * tooltip. Una serie no lleva leyenda: el título de la tarjeta la nombra.
 */
@Component({
  selector: 'mo-column-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative" [style.height.px]="height()">
      <!-- Eje y líneas guía -->
      <div class="absolute inset-0 bottom-6 left-12" aria-hidden="true">
        @for (tick of ticks(); track tick) {
          <div
            class="border-border absolute right-0 left-0 border-t"
            [style.bottom.%]="(tick / top()) * 100"
          >
            <span class="text-muted-foreground absolute -top-2 -left-12 w-11 text-right text-[10px] tabular-nums">
              {{ axis(tick) }}
            </span>
          </div>
        }
      </div>

      <!-- Columnas -->
      <div
        class="absolute inset-0 bottom-6 left-12 flex items-end"
        role="list"
        [attr.aria-label]="ariaLabel()"
      >
        @for (p of points(); track p.key; let i = $index) {
          <div
            class="group relative flex h-full flex-1 cursor-default items-end justify-center outline-none"
            role="listitem"
            tabindex="0"
            [attr.aria-label]="p.label + ': ' + full(p.value) + (p.detail ? ', ' + p.detail : '')"
            (pointerenter)="active.set(i)"
            (pointerleave)="active.set(null)"
            (focus)="active.set(i)"
            (blur)="active.set(null)"
          >
            <div
              class="w-full rounded-t-[4px] transition-[filter] group-hover:brightness-110 group-focus-visible:brightness-110"
              [style.maxWidth.px]="24"
              [style.marginInline.px]="1"
              [style.height.%]="p.value > 0 ? (p.value / top()) * 100 : 0"
              [style.minHeight.px]="p.value > 0 ? 2 : 0"
              [style.background]="color"
              [style.opacity]="active() === null || active() === i ? 1 : 0.55"
            ></div>
            @if (active() === i) {
              <div
                class="bg-card pointer-events-none absolute bottom-full z-10 mb-1 rounded-lg border px-2.5 py-1.5 text-xs whitespace-nowrap shadow-md"
                [class.left-0]="i < points().length / 3"
                [class.right-0]="i > (points().length * 2) / 3"
              >
                <p class="text-sm font-bold">{{ full(p.value) }}</p>
                <p class="text-muted-foreground">{{ p.label }}@if (p.detail) { · {{ p.detail }} }</p>
              </div>
            }
          </div>
        }
      </div>

      <!-- Etiquetas del eje X -->
      <div class="absolute right-0 bottom-0 left-12 flex h-5" aria-hidden="true">
        @for (p of points(); track p.key; let i = $index) {
          <span class="text-muted-foreground relative flex-1 text-[10px]">
            @if (i % labelEvery() === 0) {
              <!-- Centrada en su columna y sin cortar: sobra espacio porque se rotula una de cada N. -->
              <span class="absolute left-1/2 -translate-x-1/2 whitespace-nowrap">{{ p.label }}</span>
            }
          </span>
        }
      </div>
    </div>

    <details class="mt-2 text-xs">
      <summary class="text-muted-foreground hover:text-foreground cursor-pointer select-none">Ver como tabla</summary>
      <table class="mt-2 w-full">
        <tbody class="divide-y">
          @for (p of points(); track p.key) {
            <tr>
              <td class="py-1">{{ p.label }}</td>
              <td class="text-muted-foreground py-1">{{ p.detail ?? '' }}</td>
              <td class="py-1 text-right font-semibold tabular-nums">{{ full(p.value) }}</td>
            </tr>
          }
        </tbody>
      </table>
    </details>
  `,
})
export class ColumnChartComponent {
  readonly points = input.required<ChartPoint[]>()
  readonly format = input<ChartFormat>('money')
  readonly height = input(200)
  readonly ariaLabel = input('Gráfica de columnas')

  readonly color = CHART_PRIMARY
  readonly active = signal<number | null>(null)

  readonly ticks = computed(() => niceTicks(Math.max(0, ...this.points().map((p) => p.value))))
  readonly top = computed(() => this.ticks()[this.ticks().length - 1] || 1)
  /** Rotula como máximo ~6 columnas para que el eje se lea también en el celular. */
  readonly labelEvery = computed(() => Math.max(1, Math.ceil(this.points().length / 6)))

  axis(v: number): string {
    return this.format() === 'money' ? compactMoney(v) : compactCount(v)
  }

  full(v: number): string {
    return this.format() === 'money' ? formatCurrency(v) : `${Math.round(v).toLocaleString('es-CO')}`
  }
}
