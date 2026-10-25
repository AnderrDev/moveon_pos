import { NgTemplateOutlet } from '@angular/common'
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core'

/**
 * Carga de página con la forma del contenido que viene, en vez de un bloque
 * gris plano (que sobre `bg-background` casi no se ve). Las barras van dentro
 * de tarjetas blancas para que el pulso sea visible.
 *
 * - `table`: tabla (escritorio) / tarjetas (móvil). `thumb` agrega miniatura o avatar.
 * - `stats`: fila de `cards` tarjetas de cifras + panel con líneas.
 * - `summary`: tarjeta principal ancha + lateral + tabla (Caja).
 * - `form`: formulario en tarjeta + columna de vista previa (Configuración).
 */
export type PageSkeletonVariant = 'table' | 'stats' | 'summary' | 'form'
export type PageSkeletonThumb = 'none' | 'square' | 'circle'

@Component({
  selector: 'mo-page-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block', role: 'status', 'aria-live': 'polite' },
  template: `
    <span class="sr-only">{{ label() }}</span>
    <div class="animate-pulse" aria-hidden="true">
      @switch (variant()) {
        @case ('stats') {
          <div class="grid gap-4" [class]="statsGridClass()">
            @for (card of cardSlots(); track $index) {
              <div class="bg-card rounded-xl border p-5">
                <div class="bg-muted-foreground/10 h-3.5 w-24 rounded"></div>
                <div class="bg-muted-foreground/10 mt-3 h-7 w-36 rounded-md"></div>
                <div class="bg-muted-foreground/10 mt-2.5 h-3 w-20 rounded"></div>
              </div>
            }
          </div>
          <div class="bg-card mt-4 space-y-3 rounded-xl border p-5">
            <div class="bg-muted-foreground/10 h-4 w-40 rounded"></div>
            @for (row of rowSlots(); track $index) {
              <div class="flex items-center justify-between gap-6">
                <div class="bg-muted-foreground/10 h-3.5 rounded" [style.width.%]="lineWidth($index)"></div>
                <div class="bg-muted-foreground/10 h-3.5 w-20 rounded"></div>
              </div>
            }
          </div>
        }
        @case ('summary') {
          <div class="grid gap-4 lg:grid-cols-3">
            <div class="bg-card rounded-xl border lg:col-span-2">
              <div class="p-5">
                <div class="bg-muted-foreground/10 h-3.5 w-44 rounded"></div>
                <div class="bg-muted-foreground/10 mt-3 h-9 w-52 rounded-md"></div>
                <div class="bg-muted-foreground/10 mt-3 h-3 w-72 max-w-full rounded"></div>
              </div>
              <div class="grid grid-cols-3 divide-x border-y">
                @for (cell of [1, 2, 3]; track cell) {
                  <div class="px-5 py-3">
                    <div class="bg-muted-foreground/10 h-3 w-3/4 rounded"></div>
                    <div class="bg-muted-foreground/10 mt-2 h-4 w-full max-w-24 rounded"></div>
                  </div>
                }
              </div>
              <div class="space-y-2.5 p-5">
                <div class="bg-muted-foreground/10 h-4 w-36 rounded"></div>
                @for (line of [1, 2, 3]; track line) {
                  <div class="bg-muted-foreground/10 h-3.5 w-full rounded"></div>
                }
              </div>
            </div>
            <div class="bg-card space-y-4 rounded-xl border p-5">
              <div class="bg-muted-foreground/10 h-4 w-40 rounded"></div>
              @for (line of [1, 2]; track line) {
                <div class="flex items-center justify-between">
                  <div class="space-y-1.5">
                    <div class="bg-muted-foreground/10 h-3.5 w-24 rounded"></div>
                    <div class="bg-muted-foreground/10 h-3 w-14 rounded"></div>
                  </div>
                  <div class="bg-muted-foreground/10 h-5 w-20 rounded"></div>
                </div>
              }
            </div>
          </div>
          <div class="mt-4">
            <ng-container *ngTemplateOutlet="table" />
          </div>
        }
        @case ('form') {
          <div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div class="bg-card space-y-5 rounded-xl border p-6">
              <div class="space-y-2">
                <div class="bg-muted-foreground/10 h-5 w-52 rounded"></div>
                <div class="bg-muted-foreground/10 h-3.5 w-72 max-w-full rounded"></div>
              </div>
              @for (field of rowSlots(); track $index) {
                <div class="space-y-2">
                  <div class="bg-muted-foreground/10 h-3.5 w-28 rounded"></div>
                  <div class="bg-muted-foreground/10 h-10 w-full rounded-lg"></div>
                </div>
              }
            </div>
            <div class="bg-card hidden space-y-3 rounded-xl border p-5 lg:block">
              <div class="bg-muted-foreground/10 h-4 w-24 rounded"></div>
              <div class="bg-muted-foreground/10 h-64 w-full rounded-lg"></div>
            </div>
          </div>
        }
        @default {
          <ng-container *ngTemplateOutlet="table" />
        }
      }
    </div>

    <ng-template #table>
      <!-- Escritorio -->
      <div class="bg-card hidden overflow-hidden rounded-xl border md:block">
        <div class="bg-muted/70 flex h-11 items-center gap-6 px-4">
          <div class="bg-muted-foreground/20 h-3 w-24 rounded"></div>
          <div class="bg-muted-foreground/20 ml-auto h-3 w-16 rounded"></div>
          <div class="bg-muted-foreground/20 h-3 w-28 rounded"></div>
        </div>
        <div class="divide-y">
          @for (row of rowSlots(); track $index) {
            <div class="flex items-center gap-4 px-4 py-3.5">
              @if (thumb() !== 'none') {
                <div class="bg-muted-foreground/10 h-11 w-11 shrink-0" [class]="thumbShape()"></div>
              }
              <div class="min-w-0 flex-1 space-y-2">
                <div class="bg-muted-foreground/10 h-3.5 rounded" [style.width.%]="lineWidth($index)"></div>
                <div class="bg-muted-foreground/10 h-3 w-1/4 rounded"></div>
              </div>
              <div class="w-28 space-y-2">
                <div class="bg-muted-foreground/10 ml-auto h-3.5 w-20 rounded"></div>
                <div class="bg-muted-foreground/10 ml-auto h-3 w-24 rounded"></div>
              </div>
              <div class="flex w-40 justify-end gap-1.5">
                <div class="bg-muted-foreground/10 h-9 w-16 rounded-lg"></div>
                <div class="bg-muted-foreground/10 h-9 w-9 rounded-lg"></div>
              </div>
            </div>
          }
        </div>
      </div>
      <!-- Móvil -->
      <div class="space-y-2 md:hidden">
        @for (row of mobileSlots(); track $index) {
          <div class="bg-card rounded-xl border p-3">
            <div class="flex items-start gap-3">
              @if (thumb() !== 'none') {
                <div class="bg-muted-foreground/10 h-11 w-11 shrink-0" [class]="thumbShape()"></div>
              }
              <div class="min-w-0 flex-1 space-y-2">
                <div class="flex justify-between gap-3">
                  <div class="bg-muted-foreground/10 h-4 rounded" [style.width.%]="lineWidth($index)"></div>
                  <div class="bg-muted-foreground/10 h-4 w-16 rounded"></div>
                </div>
                <div class="bg-muted-foreground/10 h-3 w-1/2 rounded"></div>
              </div>
            </div>
            <div class="mt-3 flex justify-end gap-1.5 border-t pt-3">
              <div class="bg-muted-foreground/10 h-9 w-16 rounded-lg"></div>
              <div class="bg-muted-foreground/10 h-9 w-9 rounded-lg"></div>
            </div>
          </div>
        }
      </div>
    </ng-template>
  `,
  imports: [NgTemplateOutlet],
})
export class PageSkeletonComponent {
  readonly variant = input<PageSkeletonVariant>('table')
  /** Filas de la tabla, líneas del panel o campos del formulario. */
  readonly rows = input(6)
  /** Tarjetas de cifras en `stats`. */
  readonly cards = input(3)
  readonly thumb = input<PageSkeletonThumb>('none')
  /** Texto para lectores de pantalla. */
  readonly label = input('Cargando…')

  readonly rowSlots = computed(() => Array.from({ length: this.rows() }))
  readonly mobileSlots = computed(() => Array.from({ length: Math.min(this.rows(), 4) }))
  readonly cardSlots = computed(() => Array.from({ length: this.cards() }))
  readonly thumbShape = computed(() => (this.thumb() === 'circle' ? 'rounded-full' : 'rounded-lg'))
  readonly statsGridClass = computed(() =>
    this.cards() >= 5 ? 'sm:grid-cols-2 xl:grid-cols-5' : 'sm:grid-cols-3',
  )

  /** Anchos variados para que las filas no se vean idénticas. */
  lineWidth(index: number): number {
    return [46, 34, 58, 40, 52, 30][index % 6]
  }
}
