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
import { formatCurrency } from '@/shared/lib/format'
import { DialogComponent } from '../../shared/organisms/dialog.component'
import { ButtonComponent } from '../../shared/atoms/button.component'
import { FormSelectComponent, type FormSelectOption } from '../../shared/molecules/form-select.component'
import { FormCurrencyInputComponent } from '../../shared/molecules/form-currency-input.component'
import { FormTextareaComponent } from '../../shared/molecules/form-textarea.component'
import { FormErrorComponent } from '../../shared/molecules/form-error.component'
import { SessionService } from '../../core/auth/session.service'
import { ToastService } from '../../shared/organisms/toast/toast.service'
import { ExpensesRepository } from './expenses.repository'
import {
  createNominaPagoFormDefaults,
  nominaPagoFormSchema,
  type NominaPagoFormValue,
} from '@/modules/expenses/forms/nomina-pago-form.factory'
import { nominaPagoFormMapper } from '@/modules/expenses/forms/nomina-pago-form.mapper'
import {
  buildNominaPagoSugerido,
  NOMINA_TIPO_LABEL,
  type NominaTipoPago,
} from '@/modules/expenses/domain/services/nomina'
import { registerExpense } from '@/modules/expenses/application/use-cases/register-expense.use-case'
import type { Empleado, Expense } from '@/modules/expenses/domain/entities/expense.entity'

const TIPO_OPTIONS: FormSelectOption<string>[] = (
  ['mes', 'quincena1', 'quincena2', 'adelanto'] as NominaTipoPago[]
).map((tipo) => ({ value: tipo, label: NOMINA_TIPO_LABEL[tipo] }))

const METODO_OPTIONS: FormSelectOption<string>[] = [
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'efectivo_externo', label: 'Efectivo (fuera de caja)' },
  { value: 'efectivo_caja', label: 'Efectivo de la caja' },
]

type FormErrors = Partial<Record<keyof NominaPagoFormValue | 'root', string>>

@Component({
  selector: 'mo-nomina-pago-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    DialogComponent,
    ButtonComponent,
    FormSelectComponent,
    FormCurrencyInputComponent,
    FormTextareaComponent,
    FormErrorComponent,
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

        <div class="flex justify-end gap-2 pt-2">
          <mo-button variant="outline" type="button" [disabled]="saving()" (click)="onClose()">
            Cancelar
          </mo-button>
          <mo-button type="submit" [loading]="saving()" loadingText="Registrando...">
            Registrar pago
          </mo-button>
        </div>
      </form>
    </mo-dialog>
  `,
})
export class NominaPagoDialog {
  private readonly fb = inject(NonNullableFormBuilder)
  private readonly repo = inject(ExpensesRepository)
  private readonly session = inject(SessionService)
  private readonly toast = inject(ToastService)

  readonly open = input<boolean>(false)
  readonly empleado = input<Empleado | null>(null)
  /** Categoría con slug `nomina` de la tienda. */
  readonly nominaCategoryId = input.required<string | null>()

  readonly closed = output<void>()
  readonly saved = output<Expense>()

  readonly saving = signal(false)
  readonly errors = signal<FormErrors>({})
  readonly tipoOptions = TIPO_OPTIONS
  readonly metodoOptions = METODO_OPTIONS
  readonly form = this.fb.group(createNominaPagoFormDefaults())

  salarioHint(): string {
    const emp = this.empleado()
    return emp ? `Salario mensual acordado: ${formatCurrency(emp.salarioMensual)}` : ''
  }

  constructor() {
    effect(() => {
      if (this.open() && this.empleado()) {
        this.form.reset(createNominaPagoFormDefaults())
        this.errors.set({})
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
      this.errors.update((e) => ({ ...e, root: 'No existe la categoría de nómina en esta tienda' }))
      return
    }

    this.form.markAllAsTouched()
    const parsed = nominaPagoFormSchema.safeParse(this.form.getRawValue())
    if (!parsed.success) {
      const errors: FormErrors = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof NominaPagoFormValue | undefined
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
      const dto = nominaPagoFormMapper.toCreateDto(parsed.data, {
        tiendaId: auth.tiendaId,
        categoryId,
        empleado: emp,
        month: parsed.data.fechaGasto.slice(0, 7),
      })
      const result = await registerExpense({ repo: this.repo, userId: auth.userId }, dto)
      if (!result.ok) {
        this.errors.update((e) => ({ ...e, root: result.error.message }))
        return
      }
      this.toast.success(`Pago de nómina registrado para ${emp.nombre}`)
      this.saved.emit(result.value)
      this.closed.emit()
    } catch (error) {
      this.errors.update((e) => ({
        ...e,
        root: getErrorMessage(error, 'Error al registrar el pago'),
      }))
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
