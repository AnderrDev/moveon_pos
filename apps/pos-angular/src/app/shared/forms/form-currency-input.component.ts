import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core'
import { ControlContainer, FormGroupDirective, ReactiveFormsModule } from '@angular/forms'
import { formatCurrency } from '@/shared/lib/format'
import { FieldWrapperComponent } from './field-wrapper.component'

@Component({
  selector: 'mo-form-currency-input',
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
        type="text"
        inputmode="numeric"
        [value]="display()"
        [placeholder]="placeholder()"
        (focus)="onFocus()"
        (blur)="onBlur()"
        (input)="onInput($event)"
        [class]="inputClasses()"
      />
    </mo-field-wrapper>
  `,
})
export class FormCurrencyInputComponent {
  private readonly container = inject(ControlContainer) as FormGroupDirective

  readonly controlName = input.required<string>()
  readonly label = input<string | null>(null)
  readonly placeholder = input<string>('Ej: 25000')
  readonly description = input<string | null>(null)
  readonly required = input<boolean>(false)
  readonly error = input<string | null>(null)
  readonly max = input<number>(100_000_000)

  private readonly focused = signal(false)

  private get control() {
    return this.container.form.get(this.controlName())
  }

  readonly display = computed(() => {
    const value = this.control?.value as number | null | undefined
    if (this.focused()) return value && value > 0 ? String(value) : ''
    return value && value > 0 ? formatCurrency(value) : ''
  })

  readonly inputClasses = computed(() =>
    [
      'h-11 w-full rounded-lg border bg-card px-3.5 py-2 text-sm shadow-sm tabular-nums',
      'placeholder:text-muted-foreground/60',
      'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
      this.error() ? 'border-destructive focus:ring-destructive/40' : 'border-input',
    ].join(' '),
  )

  onFocus(): void {
    this.focused.set(true)
  }

  onBlur(): void {
    this.focused.set(false)
    this.control?.markAsTouched()
  }

  onInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value.replace(/\D/g, '')
    const next = raw === '' ? 0 : Math.min(Number.parseInt(raw, 10), this.max())
    this.control?.setValue(next)
    this.control?.markAsDirty()
  }
}
