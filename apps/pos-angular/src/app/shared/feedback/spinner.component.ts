import { ChangeDetectionStrategy, Component, input } from '@angular/core'

@Component({
  selector: 'mo-spinner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      role="status"
      [attr.aria-label]="label()"
      [class]="
        'inline-block animate-spin rounded-full border-2 border-current border-t-transparent ' +
        sizeClass()
      "
    ></span>
  `,
})
export class SpinnerComponent {
  readonly label = input<string>('Cargando')
  readonly size = input<'sm' | 'md' | 'lg'>('md')

  sizeClass(): string {
    return this.size() === 'sm' ? 'h-3 w-3' : this.size() === 'lg' ? 'h-6 w-6' : 'h-4 w-4'
  }
}
