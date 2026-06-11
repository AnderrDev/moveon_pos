import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core'
import { getErrorMessage } from '@/shared/lib/error-message'
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms'
import { DialogComponent } from '../../shared/ui/dialog.component'
import { ButtonComponent } from '../../shared/ui/button.component'
import { FormNumberInputComponent } from '../../shared/forms/form-number-input.component'
import { FormCurrencyInputComponent } from '../../shared/forms/form-currency-input.component'
import { FormSelectComponent, type FormSelectOption } from '../../shared/forms/form-select.component'
import { FormTextareaComponent } from '../../shared/forms/form-textarea.component'
import { FormErrorComponent } from '../../shared/forms/form-error.component'
import { InventoryRepository } from './inventory.repository'
import { SessionService } from '../../core/auth/session.service'
import { ToastService } from '../../shared/feedback/toast.service'
import { registerEntrySchema } from '@/modules/inventory/application/dtos/inventory.dto'
import type { InventoryLocation } from '@/shared/types'

interface ProductSummary {
  id: string
  nombre: string
}

const LOCATION_OPTIONS: FormSelectOption<InventoryLocation>[] = [
  { value: 'bodega', label: 'Bodega' },
  { value: 'punto_venta', label: 'Punto de venta' },
]

@Component({
  selector: 'mo-register-entry-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    DialogComponent,
    ButtonComponent,
    FormNumberInputComponent,
    FormCurrencyInputComponent,
    FormSelectComponent,
    FormTextareaComponent,
    FormErrorComponent,
  ],
  template: `
    <mo-dialog
      [open]="open()"
      title="Registrar entrada"
      [description]="product()?.nombre ?? null"
      [busy]="saving()"
      (closed)="onClose()"
    >
      <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4">
        <mo-form-number-input
          controlName="cantidad"
          label="Cantidad"
          [required]="true"
          [step]="1"
          [min]="1"
        />
        <mo-form-select
          controlName="ubicacion"
          label="Ubicacion"
          [required]="true"
          [options]="locationOptions"
          [placeholder]="null"
        />
        <mo-form-currency-input controlName="costoUnitario" label="Costo unitario" />
        <mo-form-textarea controlName="motivo" label="Motivo (opcional)" [rows]="2" />

        <mo-form-error [message]="rootError()" />

        <div class="flex justify-end gap-2 pt-2">
          <mo-button variant="outline" type="button" [disabled]="saving()" (click)="onClose()"
            >Cancelar</mo-button
          >
          <mo-button type="submit" [loading]="saving()" loadingText="Guardando..."
            >Registrar entrada</mo-button
          >
        </div>
      </form>
    </mo-dialog>
  `,
})
export class RegisterEntryDialog {
  private readonly repo = inject(InventoryRepository)
  private readonly session = inject(SessionService)
  private readonly toast = inject(ToastService)

  readonly open = input<boolean>(false)
  readonly product = input<ProductSummary | null>(null)

  readonly closed = output<void>()
  readonly saved = output<void>()

  readonly saving = signal(false)
  readonly rootError = signal<string | null>(null)
  readonly locationOptions = LOCATION_OPTIONS

  readonly form = new FormGroup({
    cantidad: new FormControl<number>(1, { nonNullable: true, validators: [Validators.required, Validators.min(1)] }),
    ubicacion: new FormControl<InventoryLocation>('bodega', { nonNullable: true, validators: [Validators.required] }),
    costoUnitario: new FormControl<number>(0, { nonNullable: true }),
    motivo: new FormControl<string>('', { nonNullable: true }),
  })

  constructor() {
    effect(() => {
      if (this.open()) {
        this.form.reset({ cantidad: 1, ubicacion: 'bodega', costoUnitario: 0, motivo: '' })
        this.rootError.set(null)
      }
    })
  }

  async submit(): Promise<void> {
    if (this.saving()) return
    this.form.markAllAsTouched()
    if (this.form.invalid) return

    const product = this.product()
    if (!product) return

    const auth = await this.session.getAuthContext()
    if (!auth) {
      this.rootError.set('Sesion expirada')
      return
    }

    this.saving.set(true)
    this.form.disable({ emitEvent: false })

    try {
      const value = this.form.getRawValue()
      const parsed = registerEntrySchema.safeParse({
        productId: product.id,
        cantidad: Number(value.cantidad),
        ubicacion: value.ubicacion,
        costoUnitario: value.costoUnitario > 0 ? value.costoUnitario : undefined,
        motivo: value.motivo.trim() || undefined,
      })
      if (!parsed.success) {
        this.rootError.set(parsed.error.issues[0]?.message ?? 'Datos de entrada invalidos')
        return
      }
      await this.repo.registerEntry({
        tiendaId: auth.tiendaId,
        productId: product.id,
        cantidad: parsed.data.cantidad,
        ubicacion: parsed.data.ubicacion,
        costoUnitario: parsed.data.costoUnitario,
        motivo: parsed.data.motivo?.trim() || undefined,
        createdBy: auth.userId,
      })
      this.toast.success(`Entrada registrada (+${value.cantidad} ${product.nombre})`)
      this.saved.emit()
      this.closed.emit()
    } catch (error) {
      this.rootError.set(getErrorMessage(error, 'Error al registrar entrada'))
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
