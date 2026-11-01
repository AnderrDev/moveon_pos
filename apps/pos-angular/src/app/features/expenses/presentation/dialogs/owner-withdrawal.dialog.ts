import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core'
import { ReactiveFormsModule } from '@angular/forms'
import { generateIdempotencyKey } from '@/shared/lib/idempotency-key'
import { getErrorMessage } from '@/shared/lib/error-message'
import { DialogComponent } from '@angular-app/shared/organisms/dialog.component'
import { ButtonComponent } from '@angular-app/shared/atoms/button.component'
import { FormSelectComponent, type FormSelectOption } from '@angular-app/shared/molecules/form-select.component'
import { FormCurrencyInputComponent } from '@angular-app/shared/molecules/form-currency-input.component'
import { FormInputComponent } from '@angular-app/shared/molecules/form-input.component'
import { FormErrorComponent } from '@angular-app/shared/molecules/form-error.component'
import { DialogFooterComponent } from '@angular-app/shared/molecules/dialog-footer.component'
import { SessionService } from '@angular-app/core/auth/session.service'
import { ToastService } from '@angular-app/shared/organisms/toast/toast.service'
import { ExpenseRepository } from '@angular-app/features/expenses/domain/repositories/expense.repository'
import { OwnerWithdrawalFormPresenter } from '@angular-app/features/expenses/presentation/presenters/owner-withdrawal-form.presenter'
import { ownerWithdrawalFormMapper } from '@angular-app/features/expenses/presentation/forms/owner-withdrawal-form.mapper'
import { registerOwnerWithdrawal } from '@angular-app/features/expenses/domain/usecases/register-owner-withdrawal.use-case'
import type { OwnerWithdrawal } from '@angular-app/features/expenses/domain/entities/expense.entity'

const ORIGEN_OPTIONS: FormSelectOption<string>[] = [
  { value: 'banco', label: 'Del banco (transferencias)' },
  { value: 'caja', label: 'De la caja (efectivo)' },
]

/**
 * Registrar un retiro del dueño (ADR 0025 §3). No es un gasto: sale del sobre
 * de utilidad. Si sale de la caja, la RPC crea la salida de caja (requiere
 * caja abierta).
 */
@Component({
  selector: 'mo-owner-withdrawal-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [OwnerWithdrawalFormPresenter],
  imports: [
    ReactiveFormsModule,
    DialogComponent,
    ButtonComponent,
    FormSelectComponent,
    FormCurrencyInputComponent,
    FormInputComponent,
    FormErrorComponent,
    DialogFooterComponent,
  ],
  template: `
    <mo-dialog
      [open]="open()"
      title="Registrar retiro"
      description="Plata que te llevas de la utilidad. No es un gasto del negocio: sale del sobre de utilidad."
      [busy]="saving()"
      width="md"
      (closed)="onClose()"
    >
      <form [formGroup]="presenter.form" (ngSubmit)="submit()" class="space-y-4">
        <div class="grid gap-4 sm:grid-cols-2">
          <mo-form-currency-input
            controlName="monto"
            label="Monto"
            [required]="true"
            placeholder="Ej: 500.000"
            [error]="presenter.errors().monto ?? null"
          />
          <mo-form-select
            controlName="origen"
            label="De dónde sale"
            [required]="true"
            [options]="origenOptions"
            [placeholder]="null"
            [error]="presenter.errors().origen ?? null"
          />
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <div class="space-y-1.5">
            <label for="withdrawal-fecha" class="text-foreground text-sm font-medium">
              Fecha <span class="text-destructive">*</span>
            </label>
            <input
              id="withdrawal-fecha"
              type="date"
              formControlName="fecha"
              class="border-input bg-card focus:ring-ring h-10 w-full rounded-lg border px-3 text-sm focus:ring-2 focus:outline-none"
            />
            @if (presenter.errors().fecha; as fechaError) {
              <p class="text-destructive text-xs">{{ fechaError }}</p>
            }
          </div>
          <mo-form-input
            controlName="nota"
            label="Para qué"
            placeholder="Ej: mercado, cuota del carro"
            [maxLength]="200"
            [error]="presenter.errors().nota ?? null"
          />
        </div>

        @if (presenter.form.controls.origen.value === 'caja') {
          <p class="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Saldrá de la caja abierta como un retiro: el cierre del día lo tendrá en cuenta.
          </p>
        }

        <mo-form-error [message]="presenter.errors().root ?? null" />

        <mo-dialog-footer>
          <mo-button variant="outline" type="button" [disabled]="saving()" (click)="onClose()">
            Cancelar
          </mo-button>
          <mo-button type="submit" [loading]="saving()" loadingText="Guardando...">
            Registrar retiro
          </mo-button>
        </mo-dialog-footer>
      </form>
    </mo-dialog>
  `,
})
export class OwnerWithdrawalDialog {
  private readonly repo = inject(ExpenseRepository)
  private readonly session = inject(SessionService)
  private readonly toast = inject(ToastService)
  protected readonly presenter = inject(OwnerWithdrawalFormPresenter)
  /** Una por apertura: los reintentos no duplican el retiro ni la salida de caja. */
  private idempotencyKey = generateIdempotencyKey()

  readonly open = input<boolean>(false)
  readonly closed = output<void>()
  readonly saved = output<OwnerWithdrawal>()

  readonly saving = signal(false)
  readonly origenOptions = ORIGEN_OPTIONS

  constructor() {
    effect(() => {
      if (this.open()) {
        this.idempotencyKey = generateIdempotencyKey()
        this.presenter.reset()
      }
    })
  }

  async submit(): Promise<void> {
    if (this.saving()) return
    const value = this.presenter.validate()
    if (!value) return

    const auth = await this.session.getAuthContext()
    if (!auth) {
      this.presenter.setRootError('Sesión expirada')
      return
    }

    this.saving.set(true)
    this.presenter.form.disable({ emitEvent: false })
    try {
      const dto = ownerWithdrawalFormMapper.toRegisterDto(value, {
        tiendaId: auth.tiendaId,
        idempotencyKey: this.idempotencyKey,
      })
      const result = await registerOwnerWithdrawal({ repo: this.repo }, dto)
      if (!result.ok) {
        this.presenter.setRootError(result.error.message)
        return
      }
      this.toast.success('Retiro registrado')
      this.saved.emit(result.value)
      this.closed.emit()
    } catch (error) {
      this.presenter.setRootError(getErrorMessage(error, 'Error al registrar el retiro'))
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
