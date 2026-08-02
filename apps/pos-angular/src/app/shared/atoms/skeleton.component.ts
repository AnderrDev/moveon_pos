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
  template: `<div [class]="classes()" aria-hidden="true"></div>`,
})
export class SkeletonComponent {
  readonly variant = input<SkeletonVariant>('block')
  /** Clase Tailwind de altura/tamaño (ej: 'h-24', 'h-72'). Solo aplica a 'block' y 'circle'. */
  readonly heightClass = input<string>('h-24')

  readonly classes = computed(() =>
    [
      'bg-muted animate-pulse',
      VARIANT_CLASSES[this.variant()],
      this.variant() === 'line' ? '' : this.heightClass(),
    ].join(' '),
  )
}
