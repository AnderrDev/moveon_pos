import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core'
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms'
import { getErrorMessage } from '@/shared/lib/error-message'
import { DialogComponent } from '../../shared/ui/dialog.component'
import { ButtonComponent } from '../../shared/ui/button.component'
import { FormCurrencyInputComponent } from '../../shared/forms/form-currency-input.component'
import { FormErrorComponent } from '../../shared/forms/form-error.component'
import { SessionService } from '../../core/auth/session.service'
import { ToastService } from '../../shared/feedback/toast.service'
import { ExpensesRepository } from './expenses.repository'
import {
  createFundSettingsFormDefaults,
  fundSettingsFormSchema,
  type FundSettingsFormValue,
} from '@/modules/expenses/forms/fund-settings-form.factory'
import { fundSettingsFormMapper } from '@/modules/expenses/forms/fund-settings-form.mapper'
import type { ReinvestmentFundSettings } from '@/modules/expenses/domain/entities/expense.entity'

type FundSettingsFormErrors = Partial<Record<keyof FundSettingsFormValue | 'root', string>>

@Component({
  selector: 'mo-fund-settings-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    DialogComponent,
    ButtonComponent,
    FormCurrencyInputComponent,
    FormErrorComponent,
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

        <div class="flex justify-end gap-2 pt-2">
          <mo-button variant="outline" type="button" [disabled]="saving()" (click)="onClose()">
            Cancelar
          </mo-button>
          <mo-button type="submit" [loading]="saving()" loadingText="Guardando...">
            Guardar fondo
          </mo-button>
        </div>
      </form>
    </mo-dialog>
  `,
})
export class FundSettingsDialog {
  private readonly fb = inject(NonNullableFormBuilder)
  private readonly repo = inject(ExpensesRepository)
  private readonly session = inject(SessionService)
  private readonly toast = inject(ToastService)

  readonly open = input<boolean>(false)
  /** Configuración actual para prellenar; `null` la primera vez. */
  readonly settings = input<ReinvestmentFundSettings | null>(null)

  readonly closed = output<void>()
  readonly saved = output<ReinvestmentFundSettings>()

  readonly saving = signal(false)
  readonly errors = signal<FundSettingsFormErrors>({})

  readonly form = this.fb.group(createFundSettingsFormDefaults())

  constructor() {
    effect(() => {
      if (this.open()) {
        const current = this.settings()
        this.form.reset(
          createFundSettingsFormDefaults(
            current
              ? { saldoInicial: current.saldoInicial, fechaInicio: current.fechaInicio }
              : {},
          ),
        )
        this.errors.set({})
      }
    })
  }

  async submit(): Promise<void> {
    if (this.saving()) return
    this.form.markAllAsTouched()
    const parsed = fundSettingsFormSchema.safeParse(this.form.getRawValue())
    if (!parsed.success) {
      const errors: FundSettingsFormErrors = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof FundSettingsFormValue | undefined
        if (field && !errors[field]) errors[field] = issue.message
      }
      this.errors.set(errors)
      return
    }

    const auth = await this.session.getAuthContext()
    if (!auth) {
      this.errors.update((e) => ({ ...e, root: 'Sesión expirada' }))
      return
    }

    this.saving.set(true)
    this.form.disable({ emitEvent: false })
    try {
      const settings = await this.repo.saveFundSettings(
        fundSettingsFormMapper.toSaveDto(parsed.data, { tiendaId: auth.tiendaId }),
      )
      this.toast.success('Fondo de reinversión configurado')
      this.saved.emit(settings)
      this.closed.emit()
    } catch (error) {
      this.errors.update((e) => ({ ...e, root: getErrorMessage(error, 'Error al guardar') }))
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
