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
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms'
import { z } from 'zod'
import { getErrorMessage } from '@/shared/lib/error-message'
import { DialogComponent } from '../../shared/organisms/dialog.component'
import { ButtonComponent } from '../../shared/atoms/button.component'
import { FormInputComponent } from '../../shared/molecules/form-input.component'
import { FormSelectComponent, type FormSelectOption } from '../../shared/molecules/form-select.component'
import { FormCurrencyInputComponent } from '../../shared/molecules/form-currency-input.component'
import { FormErrorComponent } from '../../shared/molecules/form-error.component'
import { DialogFooterComponent } from '../../shared/molecules/dialog-footer.component'
import { SessionService } from '../../core/auth/session.service'
import { ToastService } from '../../shared/organisms/toast/toast.service'
import { ExpensesRepository } from './expenses.repository'
import { saveTemplateSchema } from '@/modules/expenses/application/dtos/template.dto'
import type { ExpenseCategory, ExpenseTemplate } from '@/modules/expenses/domain/entities/expense.entity'

const templateFormSchema = saveTemplateSchema.omit({ id: true, tiendaId: true })
type TemplateFormValue = z.infer<typeof templateFormSchema>
type TemplateFormErrors = Partial<Record<keyof TemplateFormValue | 'root', string>>

const FRECUENCIA_OPTIONS: FormSelectOption<string>[] = [
  { value: 'mensual', label: 'Mensual' },
  { value: 'quincenal', label: 'Quincenal' },
]

@Component({
  selector: 'mo-template-form-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
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
  private readonly fb = inject(NonNullableFormBuilder)
  private readonly repo = inject(ExpensesRepository)
  private readonly session = inject(SessionService)
  private readonly toast = inject(ToastService)

  readonly open = input<boolean>(false)
  readonly categorias = input.required<ExpenseCategory[]>()

  readonly closed = output<void>()
  readonly saved = output<ExpenseTemplate>()

  readonly saving = signal(false)
  readonly errors = signal<TemplateFormErrors>({})
  readonly frecuenciaOptions = FRECUENCIA_OPTIONS

  readonly form = this.fb.group({
    categoryId: '',
    concepto: '',
    montoSugerido: 0,
    frecuencia: 'mensual',
  })

  readonly categoryOptions = computed<FormSelectOption<string>[]>(() =>
    this.categorias().map((c) => ({ value: c.id, label: c.nombre })),
  )

  constructor() {
    effect(() => {
      if (this.open()) {
        this.form.reset({ categoryId: '', concepto: '', montoSugerido: 0, frecuencia: 'mensual' })
        this.errors.set({})
      }
    })
  }

  async submit(): Promise<void> {
    if (this.saving()) return
    this.form.markAllAsTouched()
    const parsed = templateFormSchema.safeParse(this.form.getRawValue())
    if (!parsed.success) {
      const errors: TemplateFormErrors = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof TemplateFormValue | undefined
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
      const template = await this.repo.saveTemplate({ ...parsed.data, tiendaId: auth.tiendaId })
      this.toast.success('Plantilla creada')
      this.saved.emit(template)
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
