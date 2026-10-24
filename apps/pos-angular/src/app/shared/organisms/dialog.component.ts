import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  HostListener,
  inject,
  input,
  output,
} from '@angular/core'

/**
 * Diálogos abiertos, del más antiguo al más reciente. Escape cierra solo el de
 * arriba: con un diálogo encima de otro (selector de cliente sobre el cobro,
 * corregir pago sobre el historial) no debe cerrarse también el de abajo.
 */
const openDialogs: DialogComponent[] = []

@Component({
  selector: 'mo-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
        <button
          type="button"
          aria-label="Cerrar"
          class="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
          [disabled]="busy()"
          (click)="onClose()"
        ></button>

        <section
          role="dialog"
          aria-modal="true"
          [attr.aria-labelledby]="'mo-dialog-title'"
          class="bg-card ring-border/60 relative z-10 flex max-h-[calc(100dvh-1.5rem)] w-full flex-col overflow-hidden rounded-2xl shadow-2xl ring-1"
          [class.max-w-md]="width() === 'sm'"
          [class.max-w-lg]="width() === 'md'"
          [class.max-w-2xl]="width() === 'lg'"
          [class.max-w-3xl]="width() === 'xl'"
        >
          <div class="bg-primary h-1" [class.animate-pulse]="busy()"></div>

          <header class="flex shrink-0 items-start justify-between border-b px-5 pt-4 pb-3 sm:px-6">
            <div>
              <h2 id="mo-dialog-title" class="font-display text-lg leading-none font-bold">
                {{ title() }}
              </h2>
              @if (description()) {
                <p class="text-muted-foreground mt-1.5 text-sm">{{ description() }}</p>
              }
            </div>
            <button
              type="button"
              [disabled]="busy()"
              (click)="onClose()"
              class="text-muted-foreground hover:bg-accent ml-4 shrink-0 rounded-lg p-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Cerrar"
            >
              ×
            </button>
          </header>

          <div class="min-h-0 overflow-y-auto p-5 sm:p-6">
            <ng-content />
          </div>
        </section>
      </div>
    }
  `,
})
export class DialogComponent {
  readonly open = input<boolean>(false)
  readonly title = input.required<string>()
  readonly description = input<string | null>(null)
  readonly busy = input<boolean>(false)
  readonly width = input<'sm' | 'md' | 'lg' | 'xl'>('md')

  readonly closed = output<void>()

  constructor() {
    effect(() => {
      if (this.open()) {
        if (!openDialogs.includes(this)) openDialogs.push(this)
      } else {
        this.removeFromStack()
      }
    })
    inject(DestroyRef).onDestroy(() => this.removeFromStack())
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscape(event: Event): void {
    // Entre un listener y otro corre la detección de cambios y el de arriba ya
    // pudo salir de la pila: preventDefault marca el Escape como atendido.
    if (event.defaultPrevented || !this.open() || this.busy() || openDialogs.at(-1) !== this) return
    event.preventDefault()
    this.onClose()
  }

  private removeFromStack(): void {
    const index = openDialogs.indexOf(this)
    if (index !== -1) openDialogs.splice(index, 1)
  }

  onClose(): void {
    if (this.busy()) return
    this.closed.emit()
  }
}
