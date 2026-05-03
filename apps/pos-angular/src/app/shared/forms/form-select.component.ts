import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core'
import { ControlContainer, FormGroupDirective, ReactiveFormsModule } from '@angular/forms'
import { FieldWrapperComponent } from './field-wrapper.component'

export interface FormSelectOption<T extends string | number = string> {
  value: T
  label: string
}

@Component({
  selector: 'mo-form-select',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, FieldWrapperComponent],
  viewProviders: [{ provide: ControlContainer, useExisting: FormGroupDirective }],
  template: `
    <mo-field-wrapper
      [label]="label()"
      [description]="description()"
      [error]="error()"
      [required]="required()"
    >
      <select [formControlName]="controlName()" [class]="selectClasses()">
        @if (placeholder()) {
          <option value="">{{ placeholder() }}</option>
        }
        @for (option of options(); track option.value) {
          <option [value]="option.value">{{ option.label }}</option>
        }
      </select>
    </mo-field-wrapper>
  `,
})
export class FormSelectComponent {
  readonly controlName = input.required<string>()
  readonly options = input.required<FormSelectOption<string | number>[]>()
  readonly label = input<string | null>(null)
  readonly placeholder = input<string | null>('Selecciona una opcion')
  readonly description = input<string | null>(null)
  readonly required = input<boolean>(false)
  readonly error = input<string | null>(null)

  readonly selectClasses = computed(() =>
    [
      'h-11 w-full rounded-lg border bg-card px-3 py-2 text-sm shadow-sm',
      'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
      this.error() ? 'border-destructive focus:ring-destructive/40' : 'border-input',
    ].join(' '),
  )
}
