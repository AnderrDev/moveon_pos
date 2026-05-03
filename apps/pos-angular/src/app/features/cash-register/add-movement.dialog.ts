import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core'
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms'
import { DialogComponent } from '../../shared/ui/dialog.component'
import { ButtonComponent } from '../../shared/ui/button.component'
import { FormCurrencyInputComponent } from '../../shared/forms/form-currency-input.component'
import { FormSelectComponent, type FormSelectOption } from '../../shared/forms/form-select.component'
import { FormTextareaComponent } from '../../shared/forms/form-textarea.component'
import { FormErrorComponent } from '../../shared/forms/form-error.component'
import { CashRegisterRepository } from './cash-register.repository'
import { SessionService } from '../../core/auth/session.service'
import { ToastService } from '../../shared/feedback/toast.service'
import type { CashMovementType } from '@/shared/types'

const TIPO_OPTIONS: FormSelectOption<string>[] = [
  { value: 'cash_in', label: 'Entrada de efectivo' },
  { value: 'cash_out', label: 'Salida de efectivo' },
  { value: 'expense', label: 'Gasto' },
  { value: 'correction', label: 'Correccion' },
]

@Component({
  selector: 'mo-add-movement-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    DialogComponent,
    ButtonComponent,
    FormCurrencyInputComponent,
    FormSelectComponent,
    FormTextareaComponent,
    FormErrorComponent,
  ],
  template: `
    <mo-dialog
      [open]="open()"
      title="Movimiento de caja"
      [busy]="saving()"
      (closed)="onClose()"
    >
      <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4">
        <mo-form-select
          controlName="tipo"
          label="Tipo"
          [placeholder]="null"
          [options]="tipoOptions"
        />
        <mo-form-currency-input controlName="amount" label="Monto" [required]="true" />
        <mo-form-textarea
          controlName="motivo"
          label="Motivo"
          [required]="true"
          [rows]="2"
          placeholder="Detalle de la operacion"
        />

        <mo-form-error [message]="rootError()" />

        <div class="flex justify-end gap-2 pt-2">
          <mo-button variant="outline" type="button" [disabled]="saving()" (click)="onClose()"
            >Cancelar</mo-button
          >
          <mo-button type="submit" [loading]="saving()" loadingText="Guardando..."
            >Registrar movimiento</mo-button
          >
        </div>
      </form>
    </mo-dialog>
  `,
})
export class AddMovementDialog {
  private readonly repo = inject(CashRegisterRepository)
  private readonly session = inject(SessionService)
  private readonly toast = inject(ToastService)

  readonly open = input<boolean>(false)
  readonly sessionId = input<string | null>(null)

  readonly closed = output<void>()
  readonly saved = output<void>()

  readonly saving = signal(false)
  readonly rootError = signal<string | null>(null)
  readonly tipoOptions = TIPO_OPTIONS

  readonly form = new FormGroup({
    tipo: new FormControl<string>('cash_in', { nonNullable: true, validators: [Validators.required] }),
    amount: new FormControl<number>(0, { nonNullable: true, validators: [Validators.required, Validators.min(1)] }),
    motivo: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3)],
    }),
  })

  constructor() {
    effect(() => {
      if (this.open()) {
        this.form.reset({ tipo: 'cash_in', amount: 0, motivo: '' })
        this.rootError.set(null)
      }
    })
  }

  async submit(): Promise<void> {
    if (this.saving()) return
    this.form.markAllAsTouched()
    if (this.form.invalid) return

    const sid = this.sessionId()
    if (!sid) return

    const auth = await this.session.getAuthContext()
    if (!auth) {
      this.rootError.set('Sesion expirada')
      return
    }

    this.saving.set(true)
    this.form.disable({ emitEvent: false })

    try {
      const value = this.form.getRawValue()
      await this.repo.addMovement({
        cashSessionId: sid,
        tipo: value.tipo as CashMovementType,
        amount: value.amount,
        motivo: value.motivo.trim(),
        createdBy: auth.userId,
      })
      this.toast.success('Movimiento registrado')
      this.saved.emit()
      this.closed.emit()
    } catch (error) {
      this.rootError.set(error instanceof Error ? error.message : 'Error al registrar')
    } finally {
      this.saving.set(false)
      this.form.enable({ emitEvent: false })
    }
  }

  onClose(): void {
    if (this.saving()) return
    this.closed.emit()
  }
}
