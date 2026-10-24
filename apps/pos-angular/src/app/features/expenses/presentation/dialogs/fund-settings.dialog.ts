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
import { getErrorMessage } from '@/shared/lib/error-message'
import { DialogComponent } from '@angular-app/shared/organisms/dialog.component'
import { ButtonComponent } from '@angular-app/shared/atoms/button.component'
import { FormCurrencyInputComponent } from '@angular-app/shared/molecules/form-currency-input.component'
import { FormErrorComponent } from '@angular-app/shared/molecules/form-error.component'
import { DialogFooterComponent } from '@angular-app/shared/molecules/dialog-footer.component'
import { SessionService } from '@angular-app/core/auth/session.service'
import { ToastService } from '@angular-app/shared/organisms/toast/toast.service'
import { ExpenseRepository } from '@angular-app/features/expenses/domain/repositories/expense.repository'
import { createFundSettingsFormDefaults } from '@angular-app/features/expenses/presentation/forms/fund-settings-form.factory'
import { fundSettingsFormMapper } from '@angular-app/features/expenses/presentation/forms/fund-settings-form.mapper'
import { saveFundSettings } from '@angular-app/features/expenses/domain/usecases/save-fund-settings.use-case'
import type { ReinvestmentFundSettings } from '@angular-app/features/expenses/domain/entities/expense.entity'
import { FundSettingsFormPresenter } from '@angular-app/features/expenses/presentation/presenters/fund-settings-form.presenter'


@Component({
  selector: 'mo-fund-settings-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [FundSettingsFormPresenter],
  imports: [
    ReactiveFormsModule,
    DialogComponent,
    ButtonComponent,
    FormCurrencyInputComponent,
    FormErrorComponent,
    DialogFooterComponent,
  ],
  template: `
    <mo-dialog
      [open]="open()"
      title="Configurar fondo de reinversión"
      description="Desde la fecha de inicio, cada venta aparta el costo de lo vendido y cada entrada de inventario con costo lo descuenta."
      [busy]="saving()"
      width="md"
      (closed)="onClose()"
    >
      <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4">
        <mo-form-currency-input
          controlName="saldoInicial"
          label="Saldo inicial"
          description="Dinero que hoy ya tienes destinado a comprar mercancía (puede ser 0)."
          [error]="errors().saldoInicial ?? null"
        />

        <div class="space-y-1.5">
          <label for="fund-fecha-inicio" class="text-foreground text-sm font-medium">
            Fecha de inicio <span class="text-destructive">*</span>
          </label>
          <input
            id="fund-fecha-inicio"
            type="date"
            formControlName="fechaInicio"
            class="border-input bg-card focus:ring-ring h-10 w-full rounded-lg border px-3 text-sm focus:ring-2 focus:outline-none"
          />
          <p class="text-muted-foreground text-xs">
            Las ventas y compras anteriores a esta fecha no cuentan — el saldo inicial las resume.
          </p>
          @if (errors().fechaInicio; as fechaError) {
            <p class="text-destructive text-xs">{{ fechaError }}</p>
          }
        </div>

        <mo-form-error [message]="errors().root ?? null" />

        <mo-dialog-footer>
          <mo-button variant="outline" type="button" [disabled]="saving()" (click)="onClose()">
            Cancelar
          </mo-button>
          <mo-button type="submit" [loading]="saving()" loadingText="Guardando...">
            Guardar fondo
          </mo-button>
        </mo-dialog-footer>
      </form>
    </mo-dialog>
  `,
})
export class FundSettingsDialog {
  private readonly presenter = inject(FundSettingsFormPresenter)
  private readonly repo = inject(ExpenseRepository)
  private readonly session = inject(SessionService)
  private readonly toast = inject(ToastService)

  readonly open = input<boolean>(false)
  /** Configuración actual para prellenar; `null` la primera vez. */
  readonly settings = input<ReinvestmentFundSettings | null>(null)

  readonly closed = output<void>()
  readonly saved = output<ReinvestmentFundSettings>()

  readonly saving = signal(false)
  readonly errors = this.presenter.errors

  readonly form = this.presenter.form

  constructor() {
    effect(() => {
      if (this.open()) {
        const current = this.settings()
        this.presenter.reset(
          createFundSettingsFormDefaults(
            current
              ? { saldoInicial: current.saldoInicial, fechaInicio: current.fechaInicio }
              : {},
          ),
        )
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
    this.form.disable({ emitEvent: false })
    try {
      const dto = fundSettingsFormMapper.toSaveDto(value, { tiendaId: auth.tiendaId })
      const result = await saveFundSettings({ repo: this.repo }, dto)
      if (!result.ok) {
        this.presenter.setRootError(result.error.message)
        return
      }
      this.toast.success('Fondo de reinversión configurado')
      this.saved.emit(result.value)
      this.closed.emit()
    } catch (error) {
      this.presenter.setRootError(getErrorMessage(error, 'Error al guardar'))
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
