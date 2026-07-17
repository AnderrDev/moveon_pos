import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core'

export type BadgeVariant = 'default' | 'success' | 'warning' | 'destructive' | 'outline'

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  default: 'bg-secondary text-secondary-foreground',
  success: 'bg-emerald-500/15 text-emerald-700 ring-1 ring-inset ring-emerald-600/20',
  warning: 'bg-amber-500/15 text-amber-700 ring-1 ring-inset ring-amber-600/20',
  destructive: 'bg-red-500/15 text-red-700 ring-1 ring-inset ring-red-600/20',
  outline: 'border border-border text-muted-foreground',
}

@Component({
  selector: 'mo-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span [class]="classes()">
      @if (dot()) {
        <span class="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true"></span>
      }
      <ng-content />
    </span>
  `,
})
export class BadgeComponent {
  readonly variant = input<BadgeVariant>('default')
  readonly dot = input(false)

  readonly classes = computed(() =>
    [
      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold',
      VARIANT_CLASSES[this.variant()],
    ].join(' '),
  )
}
