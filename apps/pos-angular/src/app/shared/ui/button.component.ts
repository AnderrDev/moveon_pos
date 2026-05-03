import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core'

export type ButtonVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost'
export type ButtonSize = 'sm' | 'default' | 'lg' | 'icon'

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  default: 'bg-primary text-primary-foreground shadow-sm hover:brightness-110 active:brightness-95',
  secondary: 'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80',
  destructive: 'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
  outline: 'border border-input bg-card shadow-sm hover:bg-accent hover:text-accent-foreground',
  ghost: 'hover:bg-accent hover:text-accent-foreground',
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-xs',
  default: 'h-10 px-4 py-2',
  lg: 'h-11 px-6',
  icon: 'h-9 w-9 p-0',
}

@Component({
  selector: 'mo-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      [type]="type()"
      [disabled]="disabled() || loading()"
      [class]="classes()"
      (click)="onClick($event)"
    >
      @if (loading()) {
        <span
          class="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        ></span>
        @if (loadingText()) {
          <span>{{ loadingText() }}</span>
        } @else {
          <ng-content />
        }
      } @else {
        <ng-content />
      }
    </button>
  `,
})
export class ButtonComponent {
  readonly variant = input<ButtonVariant>('default')
  readonly size = input<ButtonSize>('default')
  readonly type = input<'button' | 'submit' | 'reset'>('button')
  readonly disabled = input(false)
  readonly loading = input(false)
  readonly loadingText = input<string | null>(null)

  readonly classes = computed(() =>
    [
      'inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-all duration-150',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
      'disabled:cursor-not-allowed disabled:opacity-50',
      VARIANT_CLASSES[this.variant()],
      SIZE_CLASSES[this.size()],
    ].join(' '),
  )

  onClick(event: MouseEvent): void {
    if (this.disabled() || this.loading()) {
      event.preventDefault()
      event.stopPropagation()
    }
  }
}
