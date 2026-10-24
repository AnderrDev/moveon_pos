import { ChangeDetectionStrategy, Component, input, output } from '@angular/core'
import { type FormControl, type FormGroup, ReactiveFormsModule } from '@angular/forms'
import { ButtonComponent } from '@angular-app/shared/atoms/button.component'
import { FormCurrencyInputComponent } from '@angular-app/shared/molecules/form-currency-input.component'
import { FormErrorComponent } from '@angular-app/shared/molecules/form-error.component'
import { MoneyPipe } from '@angular-app/shared/pipes/money.pipe'

export type OpenSessionForm = FormGroup<{ openingAmount: FormControl<number> }>

/** Tarjeta "Abrir caja" de /caja. El FormGroup y el use-case viven en la página. */
@Component({
  selector: 'mo-cash-open-session-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  imports: [ReactiveFormsModule, ButtonComponent, FormCurrencyInputComponent, FormErrorComponent, MoneyPipe],
  template: `
    <div class="bg-card mx-auto w-full max-w-md rounded-xl border p-6">
      <h2 class="font-display text-lg font-bold">Abrir caja</h2>
      <p class="text-muted-foreground mt-1 text-sm">
        Captura el efectivo inicial con el que arrancas el turno.
      </p>
      @if (suggestedAmount(); as suggested) {
        <p class="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Sugerencia del último cierre: {{ (suggested | money) }}.
        </p>
      }

      <form [formGroup]="form()" (ngSubmit)="submitted.emit()" class="mt-4 space-y-4">
        <mo-form-currency-input controlName="openingAmount" label="Monto de apertura" [required]="true" />
        <mo-form-error [message]="error()" />
        <mo-button type="submit" [loading]="opening()" loadingText="Abriendo..." class="w-full">
          Abrir caja
        </mo-button>
      </form>
    </div>
  `,
})
export class CashOpenSessionFormComponent {
  readonly form = input.required<OpenSessionForm>()
  readonly suggestedAmount = input<number | null>(null)
  readonly error = input<string | null>(null)
  readonly opening = input(false)
  readonly submitted = output<void>()
}
