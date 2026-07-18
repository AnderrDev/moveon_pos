import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core'
import { getErrorMessage } from '@/shared/lib/error-message'
import { ReactiveFormsModule } from '@angular/forms'
import { DialogComponent } from '@angular-app/shared/organisms/dialog.component'
import { ButtonComponent } from '@angular-app/shared/atoms/button.component'
import { FormInputComponent } from '@angular-app/shared/molecules/form-input.component'
import { FormSelectComponent, type FormSelectOption } from '@angular-app/shared/molecules/form-select.component'
import { FormErrorComponent } from '@angular-app/shared/molecules/form-error.component'
import { FormCheckboxComponent } from '@angular-app/shared/molecules/form-checkbox.component'
import { DialogFooterComponent } from '@angular-app/shared/molecules/dialog-footer.component'
import { CustomerRepository } from '@angular-app/features/customers/domain/repositories/customer.repository'
import { createCustomer } from '@angular-app/features/customers/domain/usecases/create-customer.use-case'
import { updateCustomer } from '@angular-app/features/customers/domain/usecases/update-customer.use-case'
import { ClienteFormPresenter } from '@angular-app/features/customers/presentation/presenters/cliente-form.presenter'
import { clienteFormMapper } from '@angular-app/features/customers/presentation/forms/cliente-form.mapper'
import { SessionService } from '@angular-app/core/auth/session.service'
import { ToastService } from '@angular-app/shared/organisms/toast/toast.service'
import type { Cliente } from '@angular-app/features/customers/domain/entities/cliente.entity'

const TIPO_OPTIONS: FormSelectOption<string>[] = [
  { value: 'CC', label: 'Cedula de ciudadania' },
  { value: 'NIT', label: 'NIT' },
  { value: 'CE', label: 'Cedula de extranjeria' },
  { value: 'PA', label: 'Pasaporte' },
]

@Component({
  selector: 'mo-cliente-form-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ClienteFormPresenter],
  imports: [
    ReactiveFormsModule,
    DialogComponent,
    ButtonComponent,
    FormInputComponent,
    FormSelectComponent,
    FormErrorComponent,
    FormCheckboxComponent,
    DialogFooterComponent,
  ],
  template: `
    <mo-dialog
      [open]="open()"
      [title]="dialogTitle()"
      [busy]="saving()"
      width="md"
      (closed)="onClose()"
    >
      <form [formGroup]="presenter.form" (ngSubmit)="submit()" class="space-y-4">
        <mo-form-input
          controlName="nombre"
          label="Nombre"
          [required]="true"
          [error]="presenter.errors().nombre ?? null"
        />

        <div class="grid gap-4 sm:grid-cols-2">
          <mo-form-select
            controlName="tipoDocumento"
            label="Tipo de documento"
            placeholder="(opcional)"
            [options]="tipoOptions"
          />
          <mo-form-input controlName="numeroDocumento" label="Numero de documento" />
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <mo-form-input controlName="email" type="email" label="Email" [error]="presenter.errors().email ?? null" />
          <mo-form-input
            controlName="telefono"
            label="Celular"
            placeholder="300 123 4567"
            [error]="presenter.errors().telefono ?? null"
          />
        </div>

        <div class="bg-muted/40 space-y-2 rounded-lg border px-3.5 py-3">
          <p class="text-xs font-bold tracking-wide uppercase">MOVE ON Club</p>
          <mo-form-checkbox
            controlName="autorizaFidelizacion"
            label="Autoriza participar en el programa de fidelización"
          />
          <mo-form-checkbox
            controlName="aceptaMensajesPromocionales"
            label="Acepta recibir mensajes promocionales (opcional)"
          />
          <p class="text-muted-foreground text-[11px]">
            El programa identifica al cliente por su número de celular: para participar
            debe registrar un celular colombiano válido.
          </p>
        </div>

        <mo-form-error [message]="presenter.errors().root ?? null" />

        <mo-dialog-footer>
          <mo-button variant="outline" type="button" [disabled]="saving()" (click)="onClose()"
            >Cancelar</mo-button
          >
          <mo-button type="submit" [loading]="saving()" loadingText="Guardando...">{{
            cliente() ? 'Guardar cambios' : 'Crear cliente'
          }}</mo-button>
        </mo-dialog-footer>
      </form>
    </mo-dialog>
  `,
})
export class ClienteFormDialog {
  private readonly repo = inject(CustomerRepository)
  private readonly session = inject(SessionService)
  private readonly toast = inject(ToastService)

  readonly presenter = inject(ClienteFormPresenter)
  readonly tipoOptions = TIPO_OPTIONS

  readonly open = input<boolean>(false)
  readonly cliente = input<Cliente | null>(null)

  readonly closed = output<void>()
  readonly saved = output<Cliente>()

  readonly saving = signal(false)

  readonly dialogTitle = computed(() => (this.cliente() ? 'Editar cliente' : 'Nuevo cliente'))

  constructor() {
    effect(() => {
      if (this.open()) {
        this.presenter.reset(clienteFormMapper.toFormValue(this.cliente()))
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
      const payload = clienteFormMapper.toPayload(value)
      const cliente = this.cliente()
      const result = cliente
        ? await updateCustomer({ repo: this.repo, tiendaId: auth.tiendaId }, cliente.id, payload)
        : await createCustomer({ repo: this.repo, tiendaId: auth.tiendaId }, payload)

      if (!result.ok) {
        this.presenter.setRootError(result.error.message)
        return
      }

      this.toast.success(cliente ? 'Cliente actualizado' : 'Cliente creado')
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
