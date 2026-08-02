import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms'
import { DialogComponent } from '@angular-app/shared/organisms/dialog.component'
import { ButtonComponent } from '@angular-app/shared/atoms/button.component'
import { FormTextareaComponent } from '@angular-app/shared/molecules/form-textarea.component'
import { FormErrorComponent } from '@angular-app/shared/molecules/form-error.component'

const REASON_MIN_LENGTH = 10

/**
 * Paso final de "asociar cliente retroactivo" (sale-history + correct-sale-customer
 * use-case): el cliente ya se eligió con `CustomerPickerDialog` (reuso, no
 * duplica esa lista/búsqueda aquí) — este diálogo solo pide el motivo, igual
 * que `CorrectPaymentDialog` para la corrección de método de pago.
 */
@Component({
  selector: 'mo-correct-sale-customer-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    DialogComponent,
    ButtonComponent,
    FormTextareaComponent,
    FormErrorComponent,
  ],
  template: `
    <mo-dialog
      [open]="open()"
      title="Asociar cliente"
      [description]="dialogDescription()"
      width="sm"
      (closed)="cancel()"
    >
      <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4">
        <mo-form-textarea
          controlName="reason"
          label="Motivo"
          [rows]="3"
          [required]="true"
          placeholder="Ej: el cliente llegó a caja después de que la venta ya estaba cobrada"
          description="Mínimo 10 caracteres. Si el producto participaba en el Club, se otorgan los sellos correspondientes."
        />

        <mo-form-error [message]="formError()" />

        <div class="flex justify-end gap-2 pt-1">
          <mo-button variant="outline" type="button" (click)="cancel()">Cancelar</mo-button>
          <mo-button variant="default" type="submit" [disabled]="!canConfirm()">
            Asociar cliente
          </mo-button>
        </div>
      </form>
    </mo-dialog>
  `,
})
export class CorrectSaleCustomerDialog {
  readonly open = input<boolean>(false)
  readonly saleNumber = input<string | null>(null)
  readonly clienteNombre = input<string | null>(null)

  readonly closed = output<void>()
  readonly confirmed = output<string>()

  readonly form = new FormGroup({
    reason: new FormControl('', { nonNullable: true }),
  })

  private readonly reasonValue = toSignal(this.form.controls.reason.valueChanges, {
    initialValue: '',
  })

  readonly canConfirm = computed(() => this.reasonValue().trim().length >= REASON_MIN_LENGTH)
  readonly formError = signal<string | null>(null)

  readonly dialogDescription = computed(() => {
    const cliente = this.clienteNombre()
    const number = this.saleNumber()
    if (cliente && number) return `Vas a asociar a ${cliente} con la venta ${number}.`
    return 'Vas a asociar este cliente a la venta.'
  })

  constructor() {
    effect(() => {
      if (this.open()) {
        this.form.reset({ reason: '' })
        this.formError.set(null)
      }
    })
  }

  submit(): void {
    const value = this.form.getRawValue().reason.trim()
    if (value.length < REASON_MIN_LENGTH) {
      this.formError.set(`El motivo debe tener al menos ${REASON_MIN_LENGTH} caracteres`)
      return
    }
    this.confirmed.emit(value)
    this.closed.emit()
  }

  cancel(): void {
    this.closed.emit()
  }
}
