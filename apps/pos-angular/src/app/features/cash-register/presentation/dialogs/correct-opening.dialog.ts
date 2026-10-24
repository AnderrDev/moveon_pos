import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core'
import { getErrorMessage } from '@/shared/lib/error-message'
import { CorrectOpeningFormPresenter } from '@angular-app/features/cash-register/presentation/presenters/correct-opening-form.presenter'
import { correctOpeningFormMapper } from '@angular-app/features/cash-register/presentation/forms/correct-opening-form.mapper'
import { ReactiveFormsModule } from '@angular/forms'
import { DialogComponent } from '@angular-app/shared/organisms/dialog.component'
import { ButtonComponent } from '@angular-app/shared/atoms/button.component'
import { FormCurrencyInputComponent } from '@angular-app/shared/molecules/form-currency-input.component'
import { FormTextareaComponent } from '@angular-app/shared/molecules/form-textarea.component'
import { FormErrorComponent } from '@angular-app/shared/molecules/form-error.component'
import { DialogFooterComponent } from '@angular-app/shared/molecules/dialog-footer.component'
import { CashRegisterRepository } from '@angular-app/features/cash-register/domain/repositories/cash-register.repository'
import { correctCashSessionOpening } from '@angular-app/features/cash-register/domain/usecases/correct-opening.use-case'
import { SessionService } from '@angular-app/core/auth/session.service'
import { ToastService } from '@angular-app/shared/organisms/toast/toast.service'
import type { CashSession } from '@angular-app/features/cash-register/domain/entities/cash-session.entity'
import { VOID_MOVEMENT_REASON_MIN_LENGTH } from '@angular-app/features/cash-register/domain/dtos/cash-register.dto'

@Component({
  selector: 'mo-correct-opening-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [CorrectOpeningFormPresenter],
  imports: [
    ReactiveFormsModule,
    DialogComponent,
    ButtonComponent,
    FormCurrencyInputComponent,
    FormTextareaComponent,
    FormErrorComponent,
    DialogFooterComponent,
  ],
  template: `
    <mo-dialog
      [open]="open()"
      title="Corregir apertura de caja"
      description="Corrige el monto de apertura registrado para esta sesión. Queda auditado el valor anterior y el nuevo."
      [busy]="saving()"
      (closed)="onClose()"
    >
      <form [formGroup]="presenter.form" (ngSubmit)="submit()" class="space-y-4">
        <mo-form-currency-input
          controlName="newAmount" [error]="presenter.errors().newAmount ?? null"
          label="Nuevo monto de apertura"
          [required]="true"
        />
        <mo-form-textarea
          controlName="reason" [error]="presenter.errors().reason ?? null"
          label="Motivo de la corrección"
          [required]="true"
          [rows]="3"
          placeholder="Explica por qué se corrige el monto de apertura"
          [description]="hint"
        />

        <mo-form-error [message]="presenter.errors().root ?? null" />

        <mo-dialog-footer>
          <mo-button variant="outline" type="button" [disabled]="saving()" (click)="onClose()"
            >Cancelar</mo-button
          >
          <mo-button type="submit" [loading]="saving()" loadingText="Guardando..."
            >Corregir apertura</mo-button
          >
        </mo-dialog-footer>
      </form>
    </mo-dialog>
  `,
})
export class CorrectOpeningDialog {
  private readonly repo = inject(CashRegisterRepository)
  private readonly session = inject(SessionService)
  private readonly toast = inject(ToastService)
  readonly presenter = inject(CorrectOpeningFormPresenter)

  readonly open = input<boolean>(false)
  readonly cashSession = input<CashSession | null>(null)

  readonly closed = output<void>()
  readonly saved = output<CashSession>()

  readonly saving = signal(false)

  readonly hint = `Mínimo ${VOID_MOVEMENT_REASON_MIN_LENGTH} caracteres.`

  constructor() {
    effect(() => {
      if (this.open()) {
        this.presenter.reset(correctOpeningFormMapper.toFormValue(this.cashSession()))
      }
    })
  }

  async submit(): Promise<void> {
    if (this.saving()) return
    const value = this.presenter.validate()
    if (!value) return

    const cashSession = this.cashSession()
    if (!cashSession) return

    const auth = await this.session.getAuthContext()
    if (!auth) {
      this.presenter.setRootError('Sesion expirada')
      return
    }

    this.saving.set(true)
    this.presenter.form.disable({ emitEvent: false })

    try {
      const result = await correctCashSessionOpening(
        { repo: this.repo, tiendaId: auth.tiendaId, correctedBy: auth.userId },
        correctOpeningFormMapper.toPayload(value, cashSession.id),
      )
      if (!result.ok) {
        this.presenter.setRootError(result.error.message)
        return
      }
      this.toast.success('Apertura de caja corregida')
      this.saved.emit(result.value)
      this.closed.emit()
    } catch (error) {
      this.presenter.setRootError(getErrorMessage(error, 'No se pudo corregir la apertura'))
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
