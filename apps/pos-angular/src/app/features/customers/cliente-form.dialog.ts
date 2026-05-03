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
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms'
import { DialogComponent } from '../../shared/ui/dialog.component'
import { ButtonComponent } from '../../shared/ui/button.component'
import { FormInputComponent } from '../../shared/forms/form-input.component'
import { FormSelectComponent, type FormSelectOption } from '../../shared/forms/form-select.component'
import { FormErrorComponent } from '../../shared/forms/form-error.component'
import { CustomersRepository } from './customers.repository'
import { SessionService } from '../../core/auth/session.service'
import { ToastService } from '../../shared/feedback/toast.service'
import type { Cliente } from '@/modules/customers/domain/entities/cliente.entity'

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
  imports: [
    ReactiveFormsModule,
    DialogComponent,
    ButtonComponent,
    FormInputComponent,
    FormSelectComponent,
    FormErrorComponent,
  ],
  template: `
    <mo-dialog
      [open]="open()"
      [title]="dialogTitle()"
      [busy]="saving()"
      width="md"
      (closed)="onClose()"
    >
      <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4">
        <mo-form-input controlName="nombre" label="Nombre" [required]="true" />

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
          <mo-form-input controlName="email" type="email" label="Email" />
          <mo-form-input controlName="telefono" label="Telefono" />
        </div>

        <mo-form-error [message]="rootError()" />

        <div class="flex justify-end gap-2 pt-2">
          <mo-button variant="outline" type="button" [disabled]="saving()" (click)="onClose()"
            >Cancelar</mo-button
          >
          <mo-button type="submit" [loading]="saving()" loadingText="Guardando...">{{
            cliente() ? 'Guardar cambios' : 'Crear cliente'
          }}</mo-button>
        </div>
      </form>
    </mo-dialog>
  `,
})
export class ClienteFormDialog {
  private readonly repo = inject(CustomersRepository)
  private readonly session = inject(SessionService)
  private readonly toast = inject(ToastService)

  readonly open = input<boolean>(false)
  readonly cliente = input<Cliente | null>(null)

  readonly closed = output<void>()
  readonly saved = output<Cliente>()

  readonly saving = signal(false)
  readonly rootError = signal<string | null>(null)
  readonly tipoOptions = TIPO_OPTIONS

  readonly form = new FormGroup({
    nombre: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2)],
    }),
    tipoDocumento: new FormControl<string>('', { nonNullable: true }),
    numeroDocumento: new FormControl<string>('', { nonNullable: true }),
    email: new FormControl<string>('', { nonNullable: true }),
    telefono: new FormControl<string>('', { nonNullable: true }),
  })

  readonly dialogTitle = computed(() => (this.cliente() ? 'Editar cliente' : 'Nuevo cliente'))

  constructor() {
    effect(() => {
      if (this.open()) {
        const c = this.cliente()
        this.form.reset({
          nombre: c?.nombre ?? '',
          tipoDocumento: c?.tipoDocumento ?? '',
          numeroDocumento: c?.numeroDocumento ?? '',
          email: c?.email ?? '',
          telefono: c?.telefono ?? '',
        })
        this.rootError.set(null)
      }
    })
  }

  async submit(): Promise<void> {
    if (this.saving()) return
    this.form.markAllAsTouched()
    if (this.form.invalid) return

    const auth = await this.session.getAuthContext()
    if (!auth) {
      this.rootError.set('Sesion expirada')
      return
    }

    this.saving.set(true)
    this.form.disable({ emitEvent: false })

    try {
      const v = this.form.getRawValue()
      const payload = {
        nombre: v.nombre.trim(),
        tipoDocumento: v.tipoDocumento || undefined,
        numeroDocumento: v.numeroDocumento.trim() || undefined,
        email: v.email.trim() || undefined,
        telefono: v.telefono.trim() || undefined,
      }
      const cliente = this.cliente()
      const result = cliente
        ? await this.repo.update(cliente.id, auth.tiendaId, payload)
        : await this.repo.create(auth.tiendaId, payload)

      this.toast.success(cliente ? 'Cliente actualizado' : 'Cliente creado')
      this.saved.emit(result)
      this.closed.emit()
    } catch (error) {
      this.rootError.set(error instanceof Error ? error.message : 'Error al guardar')
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
