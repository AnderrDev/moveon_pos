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
import { DialogComponent } from '../../shared/ui/dialog.component'
import { ButtonComponent } from '../../shared/ui/button.component'
import { FormInputComponent } from '../../shared/forms/form-input.component'
import { FormErrorComponent } from '../../shared/forms/form-error.component'
import { CategoriaFormPresenter } from './categoria-form.presenter'
import { categoriaFormMapper } from '@/modules/products/forms/categoria-form.mapper'
import { ProductsRepository } from './products.repository'
import { SessionService } from '../../core/auth/session.service'
import { ToastService } from '../../shared/feedback/toast.service'
import type { Categoria } from '@/modules/products/domain/entities/product.entity'

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

        <div class="flex justify-end gap-2 pt-2">
          <mo-button variant="outline" type="button" [disabled]="saving()" (click)="onClose()">
            Cancelar
          </mo-button>
          <mo-button type="submit" [loading]="saving()" loadingText="Guardando...">
            {{ categoria() ? 'Guardar cambios' : 'Crear categoria' }}
          </mo-button>
        </div>
      </form>
    </mo-dialog>
  `,
})
export class CategoriaFormDialog {
  private readonly repo = inject(ProductsRepository)
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
        ? await this.repo.updateCategoria(categoria.id, auth.tiendaId, value)
        : await this.repo.createCategoria(value, auth.tiendaId)

      this.toast.success(categoria ? 'Categoria actualizada' : 'Categoria creada')
      this.saved.emit(result)
      this.closed.emit()
    } catch (error) {
      this.presenter.setRootError(error instanceof Error ? error.message : 'Error al guardar')
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
