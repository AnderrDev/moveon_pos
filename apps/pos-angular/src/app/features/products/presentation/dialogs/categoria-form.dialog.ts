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
import { getErrorMessage } from '@/shared/lib/error-message'
import { ReactiveFormsModule } from '@angular/forms'
import { DialogComponent } from '@angular-app/shared/organisms/dialog.component'
import { ButtonComponent } from '@angular-app/shared/atoms/button.component'
import { FormInputComponent } from '@angular-app/shared/molecules/form-input.component'
import { FormErrorComponent } from '@angular-app/shared/molecules/form-error.component'
import { DialogFooterComponent } from '@angular-app/shared/molecules/dialog-footer.component'
import { CategoriaFormPresenter } from '@angular-app/features/products/presentation/presenters/categoria-form.presenter'
import { categoriaFormMapper } from '@angular-app/features/products/presentation/forms/categoria-form.mapper'
import { ProductRepository } from '@angular-app/features/products/domain/repositories/product.repository'
import { createCategoria } from '@angular-app/features/products/domain/usecases/create-categoria.use-case'
import { updateCategoria } from '@angular-app/features/products/domain/usecases/update-categoria.use-case'
import { SessionService } from '@angular-app/core/auth/session.service'
import { ToastService } from '@angular-app/shared/organisms/toast/toast.service'
import type { Categoria } from '@angular-app/features/products/domain/entities/product.entity'

@Component({
  selector: 'mo-categoria-form-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [CategoriaFormPresenter],
  imports: [
    ReactiveFormsModule,
    DialogComponent,
    ButtonComponent,
    FormInputComponent,
    FormErrorComponent,
    DialogFooterComponent,
  ],
  template: `
    <mo-dialog
      [open]="open()"
      [title]="dialogTitle()"
      [busy]="saving()"
      (closed)="onClose()"
    >
      <form [formGroup]="presenter.form" (ngSubmit)="submit()" class="space-y-4">
        <mo-form-input
          controlName="nombre"
          label="Nombre"
          [required]="true"
          [error]="presenter.errors().nombre ?? null"
        />

        <mo-form-error [message]="presenter.errors().root ?? null" />

        <mo-dialog-footer>
          <mo-button variant="outline" type="button" [disabled]="saving()" (click)="onClose()">
            Cancelar
          </mo-button>
          <mo-button type="submit" [loading]="saving()" loadingText="Guardando...">
            {{ categoria() ? 'Guardar cambios' : 'Crear categoria' }}
          </mo-button>
        </mo-dialog-footer>
      </form>
    </mo-dialog>
  `,
})
export class CategoriaFormDialog {
  private readonly repo = inject(ProductRepository)
  private readonly session = inject(SessionService)
  private readonly toast = inject(ToastService)

  readonly presenter = inject(CategoriaFormPresenter)

  readonly open = input<boolean>(false)
  readonly categoria = input<Categoria | null>(null)

  readonly closed = output<void>()
  readonly saved = output<Categoria>()

  readonly saving = signal(false)

  readonly dialogTitle = computed(() =>
    this.categoria() ? 'Editar categoria' : 'Nueva categoria',
  )

  constructor() {
    effect(() => {
      if (this.open()) {
        this.presenter.reset(categoriaFormMapper.toFormValue(this.categoria()))
      }
    })
  }

  async submit(): Promise<void> {
    if (this.saving()) return
    const value = this.presenter.validate()
    if (!value) return

    const auth = await this.session.getAuthContext()
    if (!auth) {
      this.presenter.setRootError('Sesion expirada')
      return
    }

    this.saving.set(true)
    this.presenter.form.disable({ emitEvent: false })

    try {
      const categoria = this.categoria()
      const result = categoria
        ? await updateCategoria({ repo: this.repo }, categoria.id, auth.tiendaId, value)
        : await createCategoria({ repo: this.repo }, auth.tiendaId, value)

      if (!result.ok) {
        this.presenter.setRootError(result.error.message)
        return
      }

      this.toast.success(categoria ? 'Categoria actualizada' : 'Categoria creada')
      this.saved.emit(result.value)
      this.closed.emit()
    } catch (error) {
      this.presenter.setRootError(getErrorMessage(error, 'Error al guardar'))
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
