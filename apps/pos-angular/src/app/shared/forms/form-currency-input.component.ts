import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core'
import { ControlContainer, FormGroupDirective, ReactiveFormsModule } from '@angular/forms'
import { clampCurrency, formatCurrency, parseCurrency } from '@/shared/lib/format'
import { FieldWrapperComponent } from './field-wrapper.component'

@Component({
  selector: 'mo-form-currency-input',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
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
        (paste)="onPaste($event)"
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
  readonly min = input<number>(0)
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
    this.commit((event.target as HTMLInputElement).value)
  }

  onPaste(event: ClipboardEvent): void {
    // Tomar el portapapeles directamente evita depender del valor intermedio
    // del DOM (que puede concatenar dígitos de forma frágil con el display
    // formateado actual). Tras `preventDefault`, re-parseamos el texto pegado.
    const pasted = event.clipboardData?.getData('text') ?? ''
    if (pasted === '') return
    event.preventDefault()
    this.commit(pasted)
  }

  /**
   * Re-parsea SIEMPRE el valor completo (DOM o portapapeles), lo normaliza a un
   * entero con `parseCurrency` y lo restringe al rango `[min, max]`. El
   * `display()` se reevalúa con el `control.value` ya normalizado, dejando el
   * campo consistente sin importar la vía de entrada.
   */
  private commit(raw: string): void {
    const next = clampCurrency(parseCurrency(raw), this.min(), this.max())
    this.control?.setValue(next)
    this.control?.markAsDirty()
  }
}
