import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core'
import { ControlContainer, FormGroupDirective, ReactiveFormsModule } from '@angular/forms'
import { FieldWrapperComponent } from './field-wrapper.component'

@Component({
  selector: 'mo-form-number-input',
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
      <input
        type="number"
        inputmode="numeric"
        [formControlName]="controlName()"
        [placeholder]="placeholder()"
        [attr.min]="min()"
        [attr.max]="max()"
        [attr.step]="step()"
        [class]="inputClasses()"
      />
    </mo-field-wrapper>
  `,
})
export class FormNumberInputComponent {
  readonly controlName = input.required<string>()
  readonly label = input<string | null>(null)
  readonly placeholder = input<string>('')
  readonly description = input<string | null>(null)
  readonly required = input<boolean>(false)
  readonly error = input<string | null>(null)
  readonly min = input<number | null>(0)
  readonly max = input<number | null>(null)
  readonly step = input<number | string>('1')

  readonly inputClasses = computed(() =>
    [
      'h-11 w-full rounded-lg border bg-card px-3.5 py-2 text-sm shadow-sm tabular-nums',
      'placeholder:text-muted-foreground/60',
      'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
      'disabled:cursor-not-allowed disabled:opacity-50',
      this.error() ? 'border-destructive focus:ring-destructive/40' : 'border-input',
    ].join(' '),
  )
}
