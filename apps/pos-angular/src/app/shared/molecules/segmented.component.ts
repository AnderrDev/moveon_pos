import { ChangeDetectionStrategy, Component, input, model } from '@angular/core'

export interface SegmentedOption {
  value: string
  label: string
}

/**
 * Grupo de botones de selección única (filtro por método de pago, estado,
 * etc.). Reemplaza las filas de botones con `xxxFilterClass()` copiadas por
 * pantalla. Uso: `<mo-segmented [options]="opts" [(value)]="filtro" />`.
 */
@Component({
  selector: 'mo-segmented',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-wrap gap-1', role: 'group' },
  template: `
    @for (option of options(); track option.value) {
      <button
        type="button"
        [attr.aria-pressed]="option.value === value()"
        [class]="buttonClass(option.value)"
        (click)="value.set(option.value)"
      >
        {{ option.label }}
      </button>
    }
  `,
})
export class SegmentedComponent {
  readonly options = input.required<readonly SegmentedOption[]>()
  readonly value = model.required<string>()

  buttonClass(optionValue: string): string {
    return [
      'rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors',
      this.value() === optionValue
        ? 'bg-secondary text-secondary-foreground'
        : 'hover:bg-muted text-muted-foreground',
    ].join(' ')
  }
}
