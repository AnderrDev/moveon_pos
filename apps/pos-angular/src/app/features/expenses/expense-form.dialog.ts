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
import { ReactiveFormsModule } from '@angular/forms'
import { getErrorMessage } from '@/shared/lib/error-message'
import { DialogComponent } from '../../shared/organisms/dialog.component'
import { ButtonComponent } from '../../shared/atoms/button.component'
import { FormInputComponent } from '../../shared/molecules/form-input.component'
import { FormSelectComponent, type FormSelectOption } from '../../shared/molecules/form-select.component'
import { FormCurrencyInputComponent } from '../../shared/molecules/form-currency-input.component'
import { FormTextareaComponent } from '../../shared/molecules/form-textarea.component'
import { FormErrorComponent } from '../../shared/molecules/form-error.component'
import { SessionService } from '../../core/auth/session.service'
import { ToastService } from '../../shared/organisms/toast/toast.service'
import { ExpensesRepository } from './expenses.repository'
import { ExpenseFormPresenter } from './expense-form.presenter'
import { expenseFormMapper } from '@/modules/expenses/forms/expense-form.mapper'
import type { ExpenseFormValue } from '@/modules/expenses/forms/expense-form.factory'
import { registerExpense } from '@/modules/expenses/application/use-cases/register-expense.use-case'
import type { Expense, ExpenseCategory } from '@/modules/expenses/domain/entities/expense.entity'

const METODO_OPTIONS: FormSelectOption<string>[] = [
  { value: 'efectivo_externo', label: 'Efectivo (fuera de caja)' },
  { value: 'efectivo_caja', label: 'Efectivo de la caja' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'tarjeta', label: 'Tarjeta' },
]

@Component({
  selector: 'mo-expense-form-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ExpenseFormPresenter],
  imports: [
    ReactiveFormsModule,
    DialogComponent,
    ButtonComponent,
    FormInputComponent,
    FormSelectComponent,
    FormCurrencyInputComponent,
    FormTextareaComponent,
    FormErrorComponent,
  ],
  template: `
    <mo-dialog
      [open]="open()"
      title="Registrar gasto"
      description="Gasto del negocio: se descuenta de las entradas del período."
      [busy]="saving()"
      width="md"
      (closed)="onClose()"
    >
      <form [formGroup]="presenter.form" (ngSubmit)="submit()" class="space-y-4">
        <div class="grid gap-4 sm:grid-cols-2">
          <mo-form-select
            controlName="categoryId"
            label="Categoría"
            [required]="true"
            [options]="categoryOptions()"
            placeholder="Selecciona una categoría"
            [error]="presenter.errors().categoryId ?? null"
          />
          <mo-form-currency-input
            controlName="monto"
            label="Monto"
            [required]="true"
            placeholder="Ej: 80.000"
            [error]="presenter.errors().monto ?? null"
          />
        </div>

        <mo-form-input
          controlName="concepto"
          label="Concepto"
          [required]="true"
          placeholder="Ej: arreglo de la licuadora, recibo de energía"
          [error]="presenter.errors().concepto ?? null"
        />

        <div class="grid gap-4 sm:grid-cols-2">
          <div class="space-y-1.5">
            <label for="expense-fecha" class="text-foreground text-sm font-medium">
              Fecha del gasto <span class="text-destructive">*</span>
            </label>
            <input
              id="expense-fecha"
              type="date"
              formControlName="fechaGasto"
              class="border-input bg-card focus:ring-ring h-10 w-full rounded-lg border px-3 text-sm focus:ring-2 focus:outline-none"
            />
            @if (presenter.errors().fechaGasto; as fechaError) {
              <p class="text-destructive text-xs">{{ fechaError }}</p>
            }
          </div>
          <mo-form-select
            controlName="metodoPago"
            label="Método de pago"
            [required]="true"
            [options]="metodoOptions"
            [placeholder]="null"
            [error]="presenter.errors().metodoPago ?? null"
          />
        </div>

        <mo-form-textarea
          controlName="notas"
          label="Notas"
          [rows]="2"
          placeholder="Detalle opcional (proveedor, referencia, etc.)"
          [error]="presenter.errors().notas ?? null"
        />

        <mo-form-error [message]="presenter.errors().root ?? null" />

        <div class="flex justify-end gap-2 pt-2">
          <mo-button variant="outline" type="button" [disabled]="saving()" (click)="onClose()">
            Cancelar
          </mo-button>
          <mo-button type="submit" [loading]="saving()" loadingText="Guardando...">
            Registrar gasto
          </mo-button>
        </div>
      </form>
    </mo-dialog>
  `,
})
export class ExpenseFormDialog {
  private readonly repo = inject(ExpensesRepository)
  private readonly session = inject(SessionService)
  private readonly toast = inject(ToastService)
  protected readonly presenter = inject(ExpenseFormPresenter)

  readonly open = input<boolean>(false)
  readonly categorias = input.required<ExpenseCategory[]>()
  /** Valores prellenados (ej. desde una plantilla recurrente). */
  readonly initial = input<Partial<ExpenseFormValue> | null>(null)
  /** Período contable (`YYYY-MM`) asignado al gasto — usado por recurrentes. */
  readonly periodo = input<string | null>(null)

  readonly closed = output<void>()
  readonly saved = output<Expense>()

  readonly saving = signal(false)
  readonly metodoOptions = METODO_OPTIONS

  readonly categoryOptions = computed<FormSelectOption<string>[]>(() =>
    this.categorias().map((c) => ({ value: c.id, label: c.nombre })),
  )

  constructor() {
    effect(() => {
      if (this.open()) this.presenter.reset(this.initial() ?? {})
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
      const dto = expenseFormMapper.toCreateDto(value, {
        tiendaId: auth.tiendaId,
        periodo: this.periodo() ?? undefined,
      })
      const result = await registerExpense({ repo: this.repo, userId: auth.userId }, dto)
      if (!result.ok) {
        this.presenter.setRootError(result.error.message)
        return
      }
      this.toast.success('Gasto registrado')
      this.saved.emit(result.value)
      this.closed.emit()
    } catch (error) {
      this.presenter.setRootError(getErrorMessage(error, 'Error al registrar el gasto'))
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
