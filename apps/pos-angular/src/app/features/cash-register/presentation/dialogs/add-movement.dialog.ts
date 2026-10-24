import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import { getErrorMessage } from '@/shared/lib/error-message'
import { AddMovementFormPresenter } from '@angular-app/features/cash-register/presentation/presenters/add-movement-form.presenter'
import { addMovementFormMapper } from '@angular-app/features/cash-register/presentation/forms/add-movement-form.mapper'
import { ReactiveFormsModule } from '@angular/forms'
import { DialogComponent } from '@angular-app/shared/organisms/dialog.component'
import { ButtonComponent } from '@angular-app/shared/atoms/button.component'
import { FormCurrencyInputComponent } from '@angular-app/shared/molecules/form-currency-input.component'
import {
  FormSelectComponent,
  type FormSelectOption,
} from '@angular-app/shared/molecules/form-select.component'
import { FormTextareaComponent } from '@angular-app/shared/molecules/form-textarea.component'
import { FormErrorComponent } from '@angular-app/shared/molecules/form-error.component'
import { DialogFooterComponent } from '@angular-app/shared/molecules/dialog-footer.component'
import { CashRegisterRepository } from '@angular-app/features/cash-register/domain/repositories/cash-register.repository'
import { addCashMovement } from '@angular-app/features/cash-register/domain/usecases/add-movement.use-case'
import { SessionService } from '@angular-app/core/auth/session.service'
import { ToastService } from '@angular-app/shared/organisms/toast/toast.service'
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
  providers: [AddMovementFormPresenter],
  imports: [
    ReactiveFormsModule,
    DialogComponent,
    ButtonComponent,
    FormCurrencyInputComponent,
    FormSelectComponent,
    FormTextareaComponent,
    FormErrorComponent,
    DialogFooterComponent,
  ],
  template: `
    <mo-dialog [open]="open()" title="Movimiento de caja" [busy]="saving()" (closed)="onClose()">
      <form [formGroup]="presenter.form" (ngSubmit)="submit()" class="space-y-4">
        <mo-form-select
          controlName="tipo" [error]="presenter.errors().tipo ?? null"
          label="Tipo"
          [placeholder]="null"
          [options]="tipoOptions"
        />
        @if (isExpense()) {
          <p class="text-muted-foreground -mt-2 text-xs">
            También queda registrado en Finanzas como "Gastos de caja".
          </p>
        }
        <mo-form-currency-input controlName="amount" [error]="presenter.errors().amount ?? null" label="Monto" [required]="true" />
        <mo-form-textarea
          controlName="motivo" [error]="presenter.errors().motivo ?? null"
          label="Motivo"
          [required]="true"
          [rows]="2"
          placeholder="Detalle de la operacion"
        />

        <mo-form-error [message]="presenter.errors().root ?? null" />

        <mo-dialog-footer>
          <mo-button variant="outline" type="button" [disabled]="saving()" (click)="onClose()"
            >Cancelar</mo-button
          >
          <mo-button type="submit" [loading]="saving()" loadingText="Guardando..."
            >Registrar movimiento</mo-button
          >
        </mo-dialog-footer>
      </form>
    </mo-dialog>
  `,
})
export class AddMovementDialog {
  private readonly repo = inject(CashRegisterRepository)
  private readonly session = inject(SessionService)
  private readonly toast = inject(ToastService)
  readonly presenter = inject(AddMovementFormPresenter)

  readonly open = input<boolean>(false)
  readonly sessionId = input<string | null>(null)
  readonly initialType = input<CashMovementType>('cash_in')

  readonly closed = output<void>()
  readonly saved = output<void>()

  readonly saving = signal(false)
  readonly tipoOptions = TIPO_OPTIONS

  private readonly tipoValue = toSignal(this.presenter.form.controls.tipo.valueChanges, {
    initialValue: this.presenter.form.controls.tipo.value,
  })
  readonly isExpense = computed(() => this.tipoValue() === 'expense')

  constructor() {
    effect(() => {
      if (this.open()) {
        this.presenter.reset({ tipo: this.initialType() })
      }
    })
  }

  async submit(): Promise<void> {
    if (this.saving()) return
    const value = this.presenter.validate()
    if (!value) return

    const sid = this.sessionId()
    if (!sid) return

    const auth = await this.session.getAuthContext()
    if (!auth) {
      this.presenter.setRootError('Sesion expirada')
      return
    }

    this.saving.set(true)
    this.presenter.form.disable({ emitEvent: false })

    try {
      const result = await addCashMovement(
        { repo: this.repo, cashSessionId: sid, createdBy: auth.userId },
        addMovementFormMapper.toPayload(value),
      )
      if (!result.ok) {
        this.presenter.setRootError(result.error.message)
        return
      }
      this.toast.success('Movimiento registrado')
      this.saved.emit()
      this.closed.emit()
    } catch (error) {
      this.presenter.setRootError(getErrorMessage(error, 'Error al registrar'))
    } finally {
      this.saving.set(false)
      this.presenter.form.enable({ emitEvent: false })
    }
  }

  onClose(): void {
    if (this.saving()) return
    this.closed.emit()
  }
}
