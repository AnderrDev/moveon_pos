import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core'
import { generateIdempotencyKey } from '@/shared/lib/idempotency-key'
import { ReactiveFormsModule } from '@angular/forms'
import { getErrorMessage } from '@/shared/lib/error-message'
import { formatCurrency } from '@/shared/lib/format'
import { DialogComponent } from '@angular-app/shared/organisms/dialog.component'
import { ButtonComponent } from '@angular-app/shared/atoms/button.component'
import { FormSelectComponent, type FormSelectOption } from '@angular-app/shared/molecules/form-select.component'
import { FormCurrencyInputComponent } from '@angular-app/shared/molecules/form-currency-input.component'
import { FormTextareaComponent } from '@angular-app/shared/molecules/form-textarea.component'
import { FormErrorComponent } from '@angular-app/shared/molecules/form-error.component'
import { DialogFooterComponent } from '@angular-app/shared/molecules/dialog-footer.component'
import { SessionService } from '@angular-app/core/auth/session.service'
import { ToastService } from '@angular-app/shared/organisms/toast/toast.service'
import { ExpenseRepository } from '@angular-app/features/expenses/domain/repositories/expense.repository'
import { nominaPagoFormMapper } from '@angular-app/features/expenses/presentation/forms/nomina-pago-form.mapper'
import {
  buildNominaPagoSugerido,
  NOMINA_TIPO_LABEL,
  type NominaTipoPago,
} from '@angular-app/features/expenses/domain/services/nomina'
import { registerExpense } from '@angular-app/features/expenses/domain/usecases/register-expense.use-case'
import type { Empleado, Expense } from '@angular-app/features/expenses/domain/entities/expense.entity'
import { NominaPagoFormPresenter } from '@angular-app/features/expenses/presentation/presenters/nomina-pago-form.presenter'

const TIPO_OPTIONS: FormSelectOption<string>[] = (
  ['mes', 'quincena1', 'quincena2', 'adelanto'] as NominaTipoPago[]
).map((tipo) => ({ value: tipo, label: NOMINA_TIPO_LABEL[tipo] }))

const METODO_OPTIONS: FormSelectOption<string>[] = [
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'efectivo_externo', label: 'Efectivo (fuera de caja)' },
  { value: 'efectivo_caja', label: 'Efectivo de la caja' },
]


@Component({
  selector: 'mo-nomina-pago-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [NominaPagoFormPresenter],
  imports: [
    ReactiveFormsModule,
    DialogComponent,
    ButtonComponent,
    FormSelectComponent,
    FormCurrencyInputComponent,
    FormTextareaComponent,
    FormErrorComponent,
    DialogFooterComponent,
  ],
  template: `
    <mo-dialog
      [open]="open()"
      [title]="'Pagar nómina — ' + (empleado()?.nombre ?? '')"
      [description]="salarioHint()"
      [busy]="saving()"
      width="md"
      (closed)="onClose()"
    >
      <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4">
        <div class="grid gap-4 sm:grid-cols-2">
          <mo-form-select
            controlName="tipo"
            label="Tipo de pago"
            [required]="true"
            [options]="tipoOptions"
            [placeholder]="null"
            [error]="errors().tipo ?? null"
          />
          <mo-form-currency-input
            controlName="monto"
            label="Monto a pagar"
            [required]="true"
            description="Precargado según el salario acordado; ajústalo si aplica."
            [error]="errors().monto ?? null"
          />
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <div class="space-y-1.5">
            <label for="nomina-fecha" class="text-foreground text-sm font-medium">
              Fecha del pago <span class="text-destructive">*</span>
            </label>
            <input
              id="nomina-fecha"
              type="date"
              formControlName="fechaGasto"
              class="border-input bg-card focus:ring-ring h-10 w-full rounded-lg border px-3 text-sm focus:ring-2 focus:outline-none"
            />
            @if (errors().fechaGasto; as fechaError) {
              <p class="text-destructive text-xs">{{ fechaError }}</p>
            }
          </div>
          <mo-form-select
            controlName="metodoPago"
            label="Método de pago"
            [required]="true"
            [options]="metodoOptions"
            [placeholder]="null"
            [error]="errors().metodoPago ?? null"
          />
        </div>

        <mo-form-textarea
          controlName="notas"
          label="Notas"
          [rows]="2"
          placeholder="Opcional — ej: descuenta el adelanto del 15"
          [error]="errors().notas ?? null"
        />

        <mo-form-error [message]="errors().root ?? null" />

        <mo-dialog-footer>
          <mo-button variant="outline" type="button" [disabled]="saving()" (click)="onClose()">
            Cancelar
          </mo-button>
          <mo-button type="submit" [loading]="saving()" loadingText="Registrando...">
            Registrar pago
          </mo-button>
        </mo-dialog-footer>
      </form>
    </mo-dialog>
  `,
})
export class NominaPagoDialog {
  private readonly presenter = inject(NominaPagoFormPresenter)
  private readonly repo = inject(ExpenseRepository)
  /**
   * Una por apertura del diálogo (se regenera al abrir): los reintentos del
   * mismo gasto no lo duplican, y un gasto nuevo nunca reutiliza la anterior.
   */
  private idempotencyKey = generateIdempotencyKey()
  private readonly session = inject(SessionService)
  private readonly toast = inject(ToastService)

  readonly open = input<boolean>(false)
  readonly empleado = input<Empleado | null>(null)
  /** Categoría con slug `nomina` de la tienda. */
  readonly nominaCategoryId = input.required<string | null>()

  readonly closed = output<void>()
  readonly saved = output<Expense>()

  readonly saving = signal(false)
  readonly errors = this.presenter.errors
  readonly tipoOptions = TIPO_OPTIONS
  readonly metodoOptions = METODO_OPTIONS
  readonly form = this.presenter.form

  salarioHint(): string {
    const emp = this.empleado()
    return emp ? `Salario mensual acordado: ${formatCurrency(emp.salarioMensual)}` : ''
  }

  constructor() {
    effect(() => {
      if (this.open() && this.empleado()) {
        this.idempotencyKey = generateIdempotencyKey()
        this.presenter.reset()
        this.applySugerido('mes')
      }
    })

    this.form.controls.tipo.valueChanges.subscribe((tipo) => {
      if (this.open()) this.applySugerido(tipo as NominaTipoPago)
    })
  }

  /** Precarga el monto según el tipo de pago y el salario acordado. */
  private applySugerido(tipo: NominaTipoPago): void {
    const emp = this.empleado()
    if (!emp) return
    const month = this.form.getRawValue().fechaGasto.slice(0, 7)
    const sugerido = buildNominaPagoSugerido(emp, tipo, month)
    this.form.controls.monto.setValue(sugerido.montoSugerido)
  }

  async submit(): Promise<void> {
    if (this.saving()) return
    const emp = this.empleado()
    const categoryId = this.nominaCategoryId()
    if (!emp) return
    if (!categoryId) {
      this.presenter.setRootError('No existe la categoría de nómina en esta tienda')
      return
    }

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
      const dto = nominaPagoFormMapper.toCreateDto(value, {
        tiendaId: auth.tiendaId,
        categoryId,
        empleado: emp,
        month: value.fechaGasto.slice(0, 7),
      })
      const result = await registerExpense(
        { repo: this.repo, userId: auth.userId },
        { ...dto, idempotencyKey: this.idempotencyKey },
      )
      if (!result.ok) {
        this.presenter.setRootError(result.error.message)
        return
      }
      this.toast.success(`Pago de nómina registrado para ${emp.nombre}`)
      this.saved.emit(result.value)
      this.closed.emit()
    } catch (error) {
      this.presenter.setRootError(getErrorMessage(error, 'Error al registrar el pago'))
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
