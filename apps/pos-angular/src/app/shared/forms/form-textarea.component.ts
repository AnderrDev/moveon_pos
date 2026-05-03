import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core'
import { ControlContainer, FormGroupDirective, ReactiveFormsModule } from '@angular/forms'
import { FieldWrapperComponent } from './field-wrapper.component'

@Component({
  selector: 'mo-form-textarea',
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
      <textarea
        [formControlName]="controlName()"
        [placeholder]="placeholder()"
        [rows]="rows()"
        [class]="textareaClasses()"
      ></textarea>
    </mo-field-wrapper>
  `,
})
export class FormTextareaComponent {
  readonly controlName = input.required<string>()
  readonly label = input<string | null>(null)
  readonly placeholder = input<string>('')
  readonly description = input<string | null>(null)
  readonly required = input<boolean>(false)
  readonly error = input<string | null>(null)
  readonly rows = input<number>(3)

  readonly textareaClasses = computed(() =>
    [
      'w-full rounded-lg border bg-card px-3 py-2 text-sm shadow-sm',
      'placeholder:text-muted-foreground/60',
      'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
      this.error() ? 'border-destructive focus:ring-destructive/40' : 'border-input',
    ].join(' '),
  )
}
