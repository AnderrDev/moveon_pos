import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core'

export type SpinnerSize = 'xs' | 'sm' | 'md'

const SIZE_CLASSES: Record<SpinnerSize, string> = {
  xs: 'h-3 w-3 border-2',
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-[3px]',
}

@Component({
  selector: 'mo-spinner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span [class]="classes()" aria-hidden="true"></span>`,
})
export class SpinnerComponent {
  readonly size = input<SpinnerSize>('sm')

  readonly classes = computed(() =>
    [
      'inline-block animate-spin rounded-full border-current border-t-transparent',
      SIZE_CLASSES[this.size()],
    ].join(' '),
  )
}
