import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core'
import { CardComponent } from '../atoms/card.component'

export type StatTone = 'default' | 'warning' | 'success' | 'muted'

const LABEL_TONE_CLASSES: Record<StatTone, string> = {
  default: 'text-muted-foreground',
  warning: 'text-amber-800',
  success: 'text-muted-foreground',
  muted: 'text-muted-foreground',
}

const VALUE_TONE_CLASSES: Record<StatTone, string> = {
  default: '',
  warning: '',
  success: 'text-emerald-600',
  muted: 'text-muted-foreground',
}

@Component({
  selector: 'mo-stat-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  imports: [CardComponent],
  template: `
    <mo-card class="h-full" [tone]="tone() === 'warning' ? 'warning' : 'default'">
      <p class="text-xs font-semibold uppercase" [class]="labelClasses()">{{ label() }}</p>
      <p class="font-display mt-2 text-2xl font-bold tabular-nums" [class]="valueClasses()">
        {{ value() }}
      </p>
      @if (hint(); as h) {
        <p class="text-muted-foreground text-xs">{{ h }}</p>
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

  readonly labelClasses = computed(() => LABEL_TONE_CLASSES[this.tone()])
  readonly valueClasses = computed(() => VALUE_TONE_CLASSES[this.tone()])
}
