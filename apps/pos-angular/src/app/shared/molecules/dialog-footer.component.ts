import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core'

export type DialogFooterAlign = 'end' | 'between'

const ALIGN_CLASSES: Record<DialogFooterAlign, string> = {
  end: 'justify-end',
  between: 'justify-between',
}

@Component({
  selector: 'mo-dialog-footer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div [class]="classes()"><ng-content /></div>`,
})
export class DialogFooterComponent {
  readonly align = input<DialogFooterAlign>('end')

  readonly classes = computed(() => ['flex gap-2 pt-2', ALIGN_CLASSES[this.align()]].join(' '))
}
