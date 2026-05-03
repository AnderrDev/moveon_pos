import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core'
import { ControlContainer, FormGroupDirective, ReactiveFormsModule } from '@angular/forms'
import { FieldWrapperComponent } from './field-wrapper.component'

@Component({
  selector: 'mo-form-input',
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
        [type]="type()"
        [formControlName]="controlName()"
        [placeholder]="placeholder()"
        [autocomplete]="autocomplete()"
        [attr.maxlength]="maxLength()"
        [class]="inputClasses()"
      />
    </mo-field-wrapper>
  `,
})
export class FormInputComponent {
  readonly controlName = input.required<string>()
  readonly label = input<string | null>(null)
  readonly type = input<'text' | 'email' | 'password' | 'search' | 'tel' | 'url'>('text')
  readonly placeholder = input<string>('')
  readonly autocomplete = input<string>('off')
  readonly maxLength = input<number | null>(null)
  readonly description = input<string | null>(null)
  readonly required = input<boolean>(false)
  readonly error = input<string | null>(null)

  readonly inputClasses = computed(() =>
    [
      'h-11 w-full rounded-lg border bg-card px-3.5 py-2 text-sm shadow-sm',
      'placeholder:text-muted-foreground/60',
      'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
      'disabled:cursor-not-allowed disabled:opacity-50',
      this.error() ? 'border-destructive focus:ring-destructive/40' : 'border-input',
    ].join(' '),
  )
}
