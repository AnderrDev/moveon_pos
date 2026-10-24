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
import { FormSelectComponent, type FormSelectOption } from '@angular-app/shared/molecules/form-select.component'
import { FormCurrencyInputComponent } from '@angular-app/shared/molecules/form-currency-input.component'
import { FormErrorComponent } from '@angular-app/shared/molecules/form-error.component'
import { DialogFooterComponent } from '@angular-app/shared/molecules/dialog-footer.component'
import { SessionService } from '@angular-app/core/auth/session.service'
import { ToastService } from '@angular-app/shared/organisms/toast/toast.service'
import { ExpenseRepository } from '@angular-app/features/expenses/domain/repositories/expense.repository'
import { templateFormMapper } from '@angular-app/features/expenses/presentation/forms/template-form.mapper'
import { saveTemplate } from '@angular-app/features/expenses/domain/usecases/save-template.use-case'
import type { ExpenseCategory, ExpenseTemplate } from '@angular-app/features/expenses/domain/entities/expense.entity'
import { TemplateFormPresenter } from '@angular-app/features/expenses/presentation/presenters/template-form.presenter'


const FRECUENCIA_OPTIONS: FormSelectOption<string>[] = [
  { value: 'mensual', label: 'Mensual' },
  { value: 'quincenal', label: 'Quincenal' },
]

@Component({
  selector: 'mo-template-form-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [TemplateFormPresenter],
  imports: [
    ReactiveFormsModule,
    DialogComponent,
    ButtonComponent,
    FormInputComponent,
    FormSelectComponent,
    FormCurrencyInputComponent,
    FormErrorComponent,
    DialogFooterComponent,
  ],
  template: `
    <mo-dialog
      [open]="open()"
      title="Nueva plantilla recurrente"
      description="Gasto fijo del mes (arriendo, servicios, suscripciones) para registrarlo con un clic."
      [busy]="saving()"
      width="md"
      (closed)="onClose()"
    >
      <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4">
        <div class="grid gap-4 sm:grid-cols-2">
          <mo-form-select
            controlName="categoryId"
            label="Categoría"
            [required]="true"
            [options]="categoryOptions()"
            placeholder="Selecciona una categoría"
            [error]="errors().categoryId ?? null"
          />
          <mo-form-select
            controlName="frecuencia"
            label="Frecuencia"
            [required]="true"
            [options]="frecuenciaOptions"
            [placeholder]="null"
            [error]="errors().frecuencia ?? null"
          />
        </div>

        <mo-form-input
          controlName="concepto"
          label="Concepto"
          [required]="true"
          placeholder="Ej: arriendo local, plan de internet"
          [error]="errors().concepto ?? null"
        />

        <mo-form-currency-input
          controlName="montoSugerido"
          label="Monto sugerido"
          [required]="true"
          description="Se precarga al usar la plantilla; el monto real se confirma cada mes."
          [error]="errors().montoSugerido ?? null"
        />

        <mo-form-error [message]="errors().root ?? null" />

        <mo-dialog-footer>
          <mo-button variant="outline" type="button" [disabled]="saving()" (click)="onClose()">
            Cancelar
          </mo-button>
          <mo-button type="submit" [loading]="saving()" loadingText="Guardando...">
            Crear plantilla
          </mo-button>
        </mo-dialog-footer>
      </form>
    </mo-dialog>
  `,
})
export class TemplateFormDialog {
  private readonly presenter = inject(TemplateFormPresenter)
  private readonly repo = inject(ExpenseRepository)
  private readonly session = inject(SessionService)
  private readonly toast = inject(ToastService)

  readonly open = input<boolean>(false)
  readonly categorias = input.required<ExpenseCategory[]>()

  readonly closed = output<void>()
  readonly saved = output<ExpenseTemplate>()

  readonly saving = signal(false)
  readonly errors = this.presenter.errors
  readonly frecuenciaOptions = FRECUENCIA_OPTIONS

  readonly form = this.presenter.form

  readonly categoryOptions = computed<FormSelectOption<string>[]>(() =>
    this.categorias().map((c) => ({ value: c.id, label: c.nombre })),
  )

  constructor() {
    effect(() => {
      if (this.open()) {
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
    this.form.disable({ emitEvent: false })
    try {
      const result = await saveTemplate(
        { repo: this.repo },
        templateFormMapper.toSaveDto(value, { tiendaId: auth.tiendaId }),
      )
      if (!result.ok) {
        this.presenter.setRootError(result.error.message)
        return
      }
      this.toast.success('Plantilla creada')
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
