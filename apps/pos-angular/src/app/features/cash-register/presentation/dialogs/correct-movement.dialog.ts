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
import { formatCurrency } from '@/shared/lib/format'
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms'
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

/**
 * Corrección de un movimiento del turno (RN-C16): monto y motivo. El tipo no se
 * corrige — para eso está anular y volver a registrar.
 */
@Component({
  selector: 'mo-correct-movement-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
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
        <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4">
          <div class="bg-muted/50 rounded-lg px-3.5 py-2.5">
            <p class="text-muted-foreground text-xs">
              {{ tipoLabel(m) }} registrado por {{ money(m.amount) }}
            </p>
            <p class="truncate text-sm font-semibold">{{ m.motivo }}</p>
          </div>

          <mo-form-currency-input controlName="newAmount" label="Monto" [required]="true" />
          <mo-form-input
            controlName="newMotivo"
            label="Concepto"
            [required]="true"
            placeholder="Ej. Pago proveedor de vasos"
          />
          <mo-form-textarea
            controlName="reason"
            label="Motivo de la corrección"
            [required]="true"
            [rows]="3"
            placeholder="Explica qué se había registrado mal"
            [description]="hint"
          />

          <mo-form-error [message]="rootError()" />

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

  readonly open = input<boolean>(false)
  readonly movement = input<CashMovement | null>(null)

  readonly closed = output<void>()
  readonly saved = output<void>()

  readonly saving = signal(false)
  readonly rootError = signal<string | null>(null)

  readonly hint = `Mínimo ${VOID_MOVEMENT_REASON_MIN_LENGTH} caracteres.`

  readonly form = new FormGroup({
    newAmount: new FormControl<number>(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1)],
    }),
    newMotivo: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3), Validators.maxLength(200)],
    }),
    reason: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(VOID_MOVEMENT_REASON_MIN_LENGTH)],
    }),
  })

  constructor() {
    effect(() => {
      if (!this.open()) return
      const movement = this.movement()
      this.form.reset({
        newAmount: movement?.amount ?? 0,
        newMotivo: movement?.motivo ?? '',
        reason: '',
      })
      this.rootError.set(null)
    })
  }

  async submit(): Promise<void> {
    if (this.saving()) return
    this.form.markAllAsTouched()
    if (this.form.invalid) return

    const movement = this.movement()
    if (!movement) return

    const auth = await this.session.getAuthContext()
    if (!auth) {
      this.rootError.set('Sesion expirada')
      return
    }

    this.saving.set(true)
    this.form.disable({ emitEvent: false })

    try {
      const value = this.form.getRawValue()
      const result = await correctCashMovement(
        { repo: this.repo, tiendaId: auth.tiendaId, correctedBy: auth.userId },
        {
          movementId: movement.id,
          newAmount: value.newAmount,
          newMotivo: value.newMotivo.trim(),
          reason: value.reason.trim(),
        },
      )
      if (!result.ok) {
        this.rootError.set(result.error.message)
        return
      }
      this.toast.success('Movimiento corregido')
      this.saved.emit()
      this.closed.emit()
    } catch (error) {
      this.rootError.set(getErrorMessage(error, 'No se pudo corregir el movimiento'))
    } finally {
      this.saving.set(false)
      this.form.enable({ emitEvent: false })
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

  money(value: number): string {
    return formatCurrency(value)
  }
}
