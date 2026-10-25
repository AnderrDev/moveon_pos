import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Directive,
  ElementRef,
  inject,
  input,
  signal,
} from '@angular/core'
import { Ellipsis, LucideAngularModule } from 'lucide-angular'
import { SpinnerComponent } from '../atoms/spinner.component'

/**
 * Menú de acciones secundarias ("Más acciones") para cabeceras con muchos
 * botones: deja visibles 1–2 acciones principales y agrupa el resto.
 * Uso: `<mo-menu><button moMenuItem (click)="...">Exportar</button></mo-menu>`.
 * Elegir un ítem, hacer clic fuera, presionar Escape o hacer scroll lo cierra.
 * El panel usa `position: fixed` para no quedar recortado dentro de tablas
 * con scroll (`mo-table-shell`), y se abre hacia arriba si no cabe abajo.
 */
@Component({
  selector: 'mo-menu',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, SpinnerComponent],
  host: {
    class: 'inline-block',
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'close()',
    '(window:resize)': 'close()',
  },
  template: `
    <button
      type="button"
      (click)="toggle($event)"
      [attr.aria-expanded]="open()"
      [attr.aria-busy]="busy()"
      aria-haspopup="menu"
      [attr.aria-label]="label()"
      [title]="label()"
      [class.h-10]="size() === 'default'"
      [class.px-3]="size() === 'default'"
      [class.h-9]="size() === 'sm'"
      [class.w-9]="size() === 'sm'"
      class="border-input bg-card hover:bg-accent focus-visible:ring-ring inline-flex items-center justify-center gap-2 rounded-lg border text-sm font-semibold shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none"
    >
      @if (busy()) {
        <mo-spinner size="sm" />
      } @else {
        <lucide-angular [img]="icons.more" class="h-4 w-4" aria-hidden="true" />
      }
      @if (showLabel()) {
        <span>{{ label() }}</span>
      }
    </button>
    @if (open()) {
      <div
        role="menu"
        [style.top.px]="position().top"
        [style.bottom.px]="position().bottom"
        [style.right.px]="position().right"
        class="bg-card fixed z-50 min-w-56 rounded-xl border p-1 shadow-lg"
      >
        <ng-content />
      </div>
    }
  `,
})
export class MenuComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef)

  readonly label = input('Más acciones')
  /** Muestra el texto junto al ícono; por defecto solo el ícono (con aria-label). */
  readonly showLabel = input(false)
  /**
   * Una acción del menú está en curso (exportar, abrir la registradora…). El
   * menú se cierra al elegir, así que el progreso se muestra en el botón ⋯.
   */
  readonly busy = input(false)
  /** `sm` iguala la altura de `mo-button size="sm"` (filas de tabla). */
  readonly size = input<'default' | 'sm'>('default')

  readonly open = signal(false)
  readonly position = signal<{ top: number | null; bottom: number | null; right: number }>({
    top: null,
    bottom: null,
    right: 0,
  })
  readonly icons = { more: Ellipsis }

  private readonly onScroll = (): void => this.close()

  constructor() {
    inject(DestroyRef).onDestroy(() => document.removeEventListener('scroll', this.onScroll, true))
  }

  toggle(event: MouseEvent): void {
    if (this.open()) {
      this.close()
      return
    }
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    const gap = 6
    const fitsBelow = rect.bottom + 260 < window.innerHeight
    this.position.set({
      top: fitsBelow ? rect.bottom + gap : null,
      bottom: fitsBelow ? null : window.innerHeight - rect.top + gap,
      right: window.innerWidth - rect.right,
    })
    this.open.set(true)
    // Captura: también cierra con el scroll de contenedores internos (tablas).
    document.addEventListener('scroll', this.onScroll, true)
  }

  close(): void {
    if (!this.open()) return
    this.open.set(false)
    document.removeEventListener('scroll', this.onScroll, true)
  }

  /** Cierra al hacer clic fuera o al elegir un ítem (el clic llega aquí después del handler del ítem). */
  onDocumentClick(event: MouseEvent): void {
    if (!this.open()) return
    const target = event.target as HTMLElement
    if (!this.host.nativeElement.contains(target) || target.closest('[role="menuitem"]')) {
      this.close()
    }
  }
}

/** Ítem de `mo-menu` (aplica rol y estilo). Funciona en `<button>` y `<a>`. */
@Directive({
  selector: '[moMenuItem]',
  standalone: true,
  host: {
    role: 'menuitem',
    class:
      'hover:bg-muted focus-visible:bg-muted flex min-h-10 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm font-medium transition-colors focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
  },
})
export class MenuItemDirective {}

export const MO_MENU = [MenuComponent, MenuItemDirective] as const
