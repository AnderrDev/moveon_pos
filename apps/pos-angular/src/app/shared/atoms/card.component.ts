import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core'

export type CardPadding = 'none' | 'sm' | 'md'
export type CardTone = 'default' | 'muted' | 'warning'

const PADDING_CLASSES: Record<CardPadding, string> = {
  none: 'p-0',
  sm: 'p-3',
  md: 'p-5',
}

const TONE_CLASSES: Record<CardTone, string> = {
  default: 'bg-card border',
  muted: 'bg-muted/40 border',
  warning: 'border border-amber-500/30 bg-amber-500/8',
}

@Component({
  selector: 'mo-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div [class]="classes()"><ng-content /></div>`,
})
export class CardComponent {
  readonly padding = input<CardPadding>('md')
  readonly tone = input<CardTone>('default')

  readonly classes = computed(() =>
    ['rounded-xl', TONE_CLASSES[this.tone()], PADDING_CLASSES[this.padding()]].join(' '),
  )
}
