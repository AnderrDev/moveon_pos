import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core'
import { CardComponent } from '../atoms/card.component'

export type StatTone = 'default' | 'warning' | 'success' | 'muted'

const VALUE_TONE_CLASSES: Record<StatTone, string> = {
  default: '',
  warning: 'text-amber-600',
  success: 'text-emerald-600',
  muted: 'text-muted-foreground',
}

@Component({
  selector: 'mo-stat-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardComponent],
  template: `
    <mo-card [tone]="tone() === 'warning' ? 'warning' : 'default'">
      <p class="text-muted-foreground text-xs font-semibold uppercase">{{ label() }}</p>
      <p class="font-display mt-2 text-2xl font-bold tabular-nums" [class]="valueClasses()">
        {{ value() }}
      </p>
      @if (hint(); as h) {
        <p class="text-muted-foreground mt-1 text-xs">{{ h }}</p>
      }
      <ng-content />
    </mo-card>
  `,
})
export class StatCardComponent {
  readonly label = input.required<string>()
  /** Valor ya formateado por el padre (moneda, número, etc.). */
  readonly value = input.required<string>()
  readonly hint = input<string | null>(null)
  readonly tone = input<StatTone>('default')

  readonly valueClasses = computed(() => VALUE_TONE_CLASSES[this.tone()])
}
