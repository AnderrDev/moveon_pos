import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core'

export type SkeletonVariant = 'block' | 'line' | 'circle'

const VARIANT_CLASSES: Record<SkeletonVariant, string> = {
  block: 'rounded-xl',
  line: 'h-4 rounded',
  circle: 'rounded-full',
}

@Component({
  selector: 'mo-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  // block: el ancho se controla con clases en <mo-skeleton class="w-24">.
  host: { class: 'block' },
  template: `<div [class]="classes()" aria-hidden="true"></div>`,
})
export class SkeletonComponent {
  readonly variant = input<SkeletonVariant>('block')
  /** Clase Tailwind de altura/tamaño (ej: 'h-24', 'h-72'). Solo aplica a 'block' y 'circle'. */
  readonly heightClass = input<string>('h-24')

  readonly classes = computed(() =>
    [
      // Gris translúcido: se ve tanto sobre tarjetas blancas como sobre el fondo de la página.
      'bg-muted-foreground/10 animate-pulse',
      VARIANT_CLASSES[this.variant()],
      this.variant() === 'line' ? '' : this.heightClass(),
      // Llena el ancho del host salvo que heightClass ya fije uno (ej. círculo 'h-10 w-10').
      /\bw-/.test(this.variant() === 'line' ? '' : this.heightClass()) ? '' : 'w-full',
    ].join(' '),
  )
}
