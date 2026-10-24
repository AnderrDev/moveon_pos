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
import { CorrectMovementFormPresenter } from '@angular-app/features/cash-register/presentation/presenters/correct-movement-form.presenter'
import { correctMovementFormMapper } from '@angular-app/features/cash-register/presentation/forms/correct-movement-form.mapper'
import { ReactiveFormsModule } from '@angular/forms'
import { DialogComponent } from '@angular-app/shared/organisms/dialog.component'
import { ButtonComponent } from '@angular-app/shared/atoms/button.component'
import { FormCurrencyInputComponent } from '@angular-app/shared/molecules/form-currency-input.component'
import { FormInputComponent } from '@angular-app/shared/molecules/form-input.component'
import { FormTextareaComponent } from '@angular-app/shared/molecules/form-textarea.component'
import { FormErrorComponent } from '@angular-app/shared/molecules/form-error.component'
import { DialogFooterComponent } from '@angular-app/shared/molecules/dialog-footer.component'
import { CashRegisterRepository } from '@angular-app/features/cash-register/domain/repositories/cash-register.repository'
import { correctCashMovement } from '@angular-app/features/cash-register/domain/usecases/correct-movement.use-case'
import { SessionService } from '@angular-app/core/auth/session.service'
import { ToastService } from '@angular-app/shared/organisms/toast/toast.service'
import type { CashMovement } from '@angular-app/features/cash-register/domain/entities/cash-session.entity'
import { VOID_MOVEMENT_REASON_MIN_LENGTH } from '@angular-app/features/cash-register/domain/dtos/cash-register.dto'
import { MoneyPipe } from '@angular-app/shared/pipes/money.pipe'

/**
 * Corrección de un movimiento del turno (RN-C16): monto y motivo. El tipo no se
 * corrige — para eso está anular y volver a registrar.
 */
@Component({
  selector: 'mo-correct-movement-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [CorrectMovementFormPresenter],
  imports: [MoneyPipe, 
    ReactiveFormsModule,
    DialogComponent,
    ButtonComponent,
    FormCurrencyInputComponent,
    FormInputComponent,
    FormTextareaComponent,
    FormErrorComponent,
    DialogFooterComponent,
  ],
  template: `
    <mo-dialog
      [open]="open()"
      title="Corregir movimiento"
      description="Corrige el monto o el concepto de este movimiento. Queda auditado lo que decía antes y lo que dice ahora."
      [busy]="saving()"
      (closed)="onClose()"
    >
      @if (movement(); as m) {
        <form [formGroup]="presenter.form" (ngSubmit)="submit()" class="space-y-4">
          <div class="bg-muted/50 rounded-lg px-3.5 py-2.5">
            <p class="text-muted-foreground text-xs">
              {{ tipoLabel(m) }} registrado por {{ (m.amount | money) }}
            </p>
            <p class="truncate text-sm font-semibold">{{ m.motivo }}</p>
          </div>

          <mo-form-currency-input controlName="newAmount" [error]="presenter.errors().newAmount ?? null" label="Monto" [required]="true" />
          <mo-form-input
            controlName="newMotivo" [error]="presenter.errors().newMotivo ?? null"
            label="Concepto"
            [required]="true"
            placeholder="Ej. Pago proveedor de vasos"
          />
          <mo-form-textarea
            controlName="reason" [error]="presenter.errors().reason ?? null"
            label="Motivo de la corrección"
            [required]="true"
            [rows]="3"
            placeholder="Explica qué se había registrado mal"
            [description]="hint"
          />

          <mo-form-error [message]="presenter.errors().root ?? null" />

          <mo-dialog-footer>
            <mo-button variant="outline" type="button" [disabled]="saving()" (click)="onClose()">
              Cancelar
            </mo-button>
            <mo-button type="submit" [loading]="saving()" loadingText="Guardando...">
              Corregir movimiento
            </mo-button>
          </mo-dialog-footer>
        </form>
      }
    </mo-dialog>
  `,
})
export class CorrectMovementDialog {
  private readonly repo = inject(CashRegisterRepository)
  private readonly session = inject(SessionService)
  private readonly toast = inject(ToastService)
  readonly presenter = inject(CorrectMovementFormPresenter)

  readonly open = input<boolean>(false)
  readonly movement = input<CashMovement | null>(null)

  readonly closed = output<void>()
  readonly saved = output<void>()

  readonly saving = signal(false)

  readonly hint = `Mínimo ${VOID_MOVEMENT_REASON_MIN_LENGTH} caracteres.`

  constructor() {
    effect(() => {
      if (!this.open()) return
      this.presenter.reset(correctMovementFormMapper.toFormValue(this.movement()))
    })
  }

  async submit(): Promise<void> {
    if (this.saving()) return
    const value = this.presenter.validate()
    if (!value) return

    const movement = this.movement()
    if (!movement) return

    const auth = await this.session.getAuthContext()
    if (!auth) {
      this.presenter.setRootError('Sesion expirada')
      return
    }

    this.saving.set(true)
    this.presenter.form.disable({ emitEvent: false })

    try {
      const result = await correctCashMovement(
        { repo: this.repo, tiendaId: auth.tiendaId, correctedBy: auth.userId },
        correctMovementFormMapper.toPayload(value, movement.id),
      )
      if (!result.ok) {
        this.presenter.setRootError(result.error.message)
        return
      }
      this.toast.success('Movimiento corregido')
      this.saved.emit()
      this.closed.emit()
    } catch (error) {
      this.presenter.setRootError(getErrorMessage(error, 'No se pudo corregir el movimiento'))
    } finally {
      this.saving.set(false)
      this.presenter.form.enable({ emitEvent: false })
    }
  }

  onClose(): void {
    if (this.saving()) return
    this.closed.emit()
  }

  tipoLabel(movement: CashMovement): string {
    const labels: Record<string, string> = {
      cash_in: 'Ingreso',
      cash_out: 'Retiro',
      expense: 'Gasto',
      correction: 'Corrección',
    }
    return labels[movement.tipo] ?? movement.tipo
  }

}
