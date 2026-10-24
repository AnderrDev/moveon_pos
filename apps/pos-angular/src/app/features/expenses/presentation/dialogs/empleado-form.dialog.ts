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
import { DialogComponent } from '@angular-app/shared/organisms/dialog.component'
import { ButtonComponent } from '@angular-app/shared/atoms/button.component'
import { FormInputComponent } from '@angular-app/shared/molecules/form-input.component'
import { FormCurrencyInputComponent } from '@angular-app/shared/molecules/form-currency-input.component'
import { FormCheckboxComponent } from '@angular-app/shared/molecules/form-checkbox.component'
import { FormErrorComponent } from '@angular-app/shared/molecules/form-error.component'
import { DialogFooterComponent } from '@angular-app/shared/molecules/dialog-footer.component'
import { SessionService } from '@angular-app/core/auth/session.service'
import { ToastService } from '@angular-app/shared/organisms/toast/toast.service'
import { ExpenseRepository } from '@angular-app/features/expenses/domain/repositories/expense.repository'
import { empleadoFormMapper } from '@angular-app/features/expenses/presentation/forms/empleado-form.mapper'
import { saveEmpleado } from '@angular-app/features/expenses/domain/usecases/save-empleado.use-case'
import type { Empleado } from '@angular-app/features/expenses/domain/entities/expense.entity'
import { EmpleadoFormPresenter } from '@angular-app/features/expenses/presentation/presenters/empleado-form.presenter'


@Component({
  selector: 'mo-empleado-form-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [EmpleadoFormPresenter],
  imports: [
    ReactiveFormsModule,
    DialogComponent,
    ButtonComponent,
    FormInputComponent,
    FormCurrencyInputComponent,
    FormCheckboxComponent,
    FormErrorComponent,
    DialogFooterComponent,
  ],
  template: `
    <mo-dialog
      [open]="open()"
      [title]="dialogTitle()"
      description="Nómina simulada: registra el pago acordado, sin cálculos legales."
      [busy]="saving()"
      width="md"
      (closed)="onClose()"
    >
      <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4">
        <div class="grid gap-4 sm:grid-cols-2">
          <mo-form-input
            controlName="nombre"
            label="Nombre"
            [required]="true"
            [error]="errors().nombre ?? null"
          />
          <mo-form-input
            controlName="cargo"
            label="Cargo"
            placeholder="(opcional)"
            [error]="errors().cargo ?? null"
          />
        </div>

        <mo-form-currency-input
          controlName="salarioMensual"
          label="Salario mensual acordado"
          [required]="true"
          placeholder="Ej: 1.800.000"
          description="Costo total pactado por mes — es lo que se precarga al pagar."
          [error]="errors().salarioMensual ?? null"
        />

        @if (empleado()) {
          <mo-form-checkbox controlName="isActive" label="Empleado activo" />
        }

        <mo-form-error [message]="errors().root ?? null" />

        <mo-dialog-footer>
          <mo-button variant="outline" type="button" [disabled]="saving()" (click)="onClose()">
            Cancelar
          </mo-button>
          <mo-button type="submit" [loading]="saving()" loadingText="Guardando...">
            {{ empleado() ? 'Guardar cambios' : 'Crear empleado' }}
          </mo-button>
        </mo-dialog-footer>
      </form>
    </mo-dialog>
  `,
})
export class EmpleadoFormDialog {
  private readonly presenter = inject(EmpleadoFormPresenter)
  private readonly repo = inject(ExpenseRepository)
  private readonly session = inject(SessionService)
  private readonly toast = inject(ToastService)

  readonly open = input<boolean>(false)
  readonly empleado = input<Empleado | null>(null)

  readonly closed = output<void>()
  readonly saved = output<Empleado>()

  readonly saving = signal(false)
  readonly errors = this.presenter.errors
  readonly form = this.presenter.form

  readonly dialogTitle = computed(() => (this.empleado() ? 'Editar empleado' : 'Nuevo empleado'))

  constructor() {
    effect(() => {
      if (this.open()) {
        this.presenter.reset(empleadoFormMapper.toFormValue(this.empleado()))
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
      const dto = empleadoFormMapper.toSaveDto(value, {
        tiendaId: auth.tiendaId,
        empleadoId: this.empleado()?.id,
      })
      const result = await saveEmpleado({ repo: this.repo }, dto)
      if (!result.ok) {
        this.presenter.setRootError(result.error.message)
        return
      }
      this.toast.success(this.empleado() ? 'Empleado actualizado' : 'Empleado creado')
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
