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
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms'
import { DialogComponent } from '@angular-app/shared/organisms/dialog.component'
import { ButtonComponent } from '@angular-app/shared/atoms/button.component'
import { FormCurrencyInputComponent } from '@angular-app/shared/molecules/form-currency-input.component'
import { FormTextareaComponent } from '@angular-app/shared/molecules/form-textarea.component'
import { FormErrorComponent } from '@angular-app/shared/molecules/form-error.component'
import { DialogFooterComponent } from '@angular-app/shared/molecules/dialog-footer.component'
import { CashRegisterRepository } from '@angular-app/features/cash-register/data/repositories/cash-register.repository'
import { SessionService } from '@angular-app/core/auth/session.service'
import { ToastService } from '@angular-app/shared/organisms/toast/toast.service'
import type { CashSession } from '@angular-app/features/cash-register/domain/entities/cash-session.entity'
import { VOID_MOVEMENT_REASON_MIN_LENGTH } from '@angular-app/features/cash-register/domain/dtos/cash-register.dto'

@Component({
  selector: 'mo-correct-opening-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
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
      <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4">
        <mo-form-currency-input
          controlName="newAmount"
          label="Nuevo monto de apertura"
          [required]="true"
        />
        <mo-form-textarea
          controlName="reason"
          label="Motivo de la corrección"
          [required]="true"
          [rows]="3"
          placeholder="Explica por qué se corrige el monto de apertura"
          [description]="hint"
        />

        <mo-form-error [message]="rootError()" />

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

  readonly open = input<boolean>(false)
  readonly cashSession = input<CashSession | null>(null)

  readonly closed = output<void>()
  readonly saved = output<CashSession>()

  readonly saving = signal(false)
  readonly rootError = signal<string | null>(null)

  readonly hint = `Mínimo ${VOID_MOVEMENT_REASON_MIN_LENGTH} caracteres.`

  readonly form = new FormGroup({
    newAmount: new FormControl<number>(0, { nonNullable: true, validators: [Validators.required, Validators.min(0)] }),
    reason: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(VOID_MOVEMENT_REASON_MIN_LENGTH)],
    }),
  })

  constructor() {
    effect(() => {
      if (this.open()) {
        const current = this.cashSession()?.openingAmount ?? 0
        this.form.reset({ newAmount: current, reason: '' })
        this.rootError.set(null)
      }
    })
  }

  async submit(): Promise<void> {
    if (this.saving()) return
    this.form.markAllAsTouched()
    if (this.form.invalid) return

    const cashSession = this.cashSession()
    if (!cashSession) return

    const auth = await this.session.getAuthContext()
    if (!auth) {
      this.rootError.set('Sesion expirada')
      return
    }

    this.saving.set(true)
    this.form.disable({ emitEvent: false })

    try {
      const value = this.form.getRawValue()
      const updated = await this.repo.correctOpening({
        sessionId: cashSession.id,
        tiendaId: auth.tiendaId,
        newAmount: value.newAmount,
        correctedBy: auth.userId,
        reason: value.reason.trim(),
      })
      this.toast.success('Apertura de caja corregida')
      this.saved.emit(updated)
      this.closed.emit()
    } catch (error) {
      this.rootError.set(getErrorMessage(error, 'No se pudo corregir la apertura'))
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
