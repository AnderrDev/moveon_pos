import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core'
import { ReactiveFormsModule, FormControl, FormGroup } from '@angular/forms'
import { toSignal } from '@angular/core/rxjs-interop'
import { DialogComponent } from '@angular-app/shared/organisms/dialog.component'
import { ButtonComponent } from '@angular-app/shared/atoms/button.component'
import { FormSelectComponent } from '@angular-app/shared/molecules/form-select.component'
import { FormTextareaComponent } from '@angular-app/shared/molecules/form-textarea.component'
import { FormErrorComponent } from '@angular-app/shared/molecules/form-error.component'
import { correctPaymentSchema } from '@angular-app/features/sales/domain/dtos/sale.dto'
import type { CorrectPaymentDto } from '@angular-app/features/sales/domain/dtos/sale.dto'
import type { PaymentMethod } from '@/shared/types'
import { PAYMENT_METHOD_OPTIONS } from '@/shared/lib/payment-methods'

@Component({
  selector: 'mo-correct-payment-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    DialogComponent,
    ButtonComponent,
    FormSelectComponent,
    FormTextareaComponent,
    FormErrorComponent,
  ],
  template: `
    <mo-dialog
      [open]="open()"
      [title]="dialogTitle()"
      description="Corrige el método de pago registrado. El monto no se modifica."
      width="sm"
      (closed)="cancel()"
    >
      <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4">
        <mo-form-select
          controlName="newMetodo"
          label="Nuevo método de pago"
          [options]="paymentOptions"
          [required]="true"
          [placeholder]="null"
        />

        <mo-form-textarea
          controlName="reason"
          label="Motivo de la corrección"
          [rows]="3"
          [required]="true"
          placeholder="Describe por qué se corrige el método de pago"
          description="Mínimo 10 caracteres. Queda registrado en la auditoría."
        />

        <mo-form-error [message]="formError()" />

        <div class="flex justify-end gap-2 pt-1">
          <mo-button variant="outline" type="button" (click)="cancel()">Cancelar</mo-button>
          <mo-button variant="default" type="submit" [disabled]="!canConfirm()">
            Confirmar corrección
          </mo-button>
        </div>
      </form>
    </mo-dialog>
  `,
})
export class CorrectPaymentDialog {
  readonly open = input<boolean>(false)
  readonly paymentId = input<string | null>(null)
  readonly currentMetodo = input<PaymentMethod | null>(null)
  readonly saleNumber = input<string | null>(null)

  readonly closed = output<void>()
  readonly confirmed = output<{ paymentId: string; newMetodo: PaymentMethod; reason: string }>()

  readonly paymentOptions = PAYMENT_METHOD_OPTIONS

  readonly form = new FormGroup({
    newMetodo: new FormControl<PaymentMethod>('cash', { nonNullable: true }),
    reason: new FormControl('', { nonNullable: true }),
  })

  private readonly newMetodoValue = toSignal(this.form.controls.newMetodo.valueChanges, {
    initialValue: this.form.controls.newMetodo.value,
  })
  private readonly reasonValue = toSignal(this.form.controls.reason.valueChanges, {
    initialValue: '',
  })

  readonly canConfirm = computed(() => {
    const metodo = this.newMetodoValue()
    const reason = this.reasonValue()
    return metodo !== this.currentMetodo() && reason.trim().length >= 10
  })

  readonly formError = signal<string | null>(null)

  readonly dialogTitle = computed(() => {
    const number = this.saleNumber()
    return number ? `Corregir método de pago — Venta #${number}` : 'Corregir método de pago'
  })

  constructor() {
    effect(() => {
      if (this.open()) {
        this.form.reset({
          newMetodo: this.currentMetodo() ?? 'cash',
          reason: '',
        })
        this.formError.set(null)
      }
    })
  }

  submit(): void {
    const result = correctPaymentSchema.safeParse({
      paymentId: this.paymentId(),
      newMetodo: this.form.controls.newMetodo.value,
      reason: this.form.controls.reason.value,
    })
    if (!result.success) {
      this.formError.set(result.error.errors[0]?.message ?? 'Datos inválidos')
      return
    }
    const dto = result.data as CorrectPaymentDto
    this.confirmed.emit({
      paymentId: dto.paymentId,
      newMetodo: dto.newMetodo as PaymentMethod,
      reason: dto.reason,
    })
    this.closed.emit()
  }

  cancel(): void {
    this.closed.emit()
  }
}
