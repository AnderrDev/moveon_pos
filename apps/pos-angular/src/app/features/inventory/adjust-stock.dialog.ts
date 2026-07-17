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
import { DialogComponent } from '../../shared/organisms/dialog.component'
import { ButtonComponent } from '../../shared/atoms/button.component'
import { FormNumberInputComponent } from '../../shared/molecules/form-number-input.component'
import { FormSelectComponent, type FormSelectOption } from '../../shared/molecules/form-select.component'
import { FormTextareaComponent } from '../../shared/molecules/form-textarea.component'
import { FormErrorComponent } from '../../shared/molecules/form-error.component'
import { DialogFooterComponent } from '../../shared/molecules/dialog-footer.component'
import { InventoryRepository } from './inventory.repository'
import { SessionService } from '../../core/auth/session.service'
import { ToastService } from '../../shared/organisms/toast/toast.service'
import { adjustStockSchema } from '@/modules/inventory/application/dtos/inventory.dto'
import type { InventoryLocation } from '@/shared/types'

interface ProductSummary {
  id: string
  nombre: string
  puntoVentaStock: number
  bodegaStock: number
}

const LOCATION_OPTIONS: FormSelectOption<InventoryLocation>[] = [
  { value: 'punto_venta', label: 'Punto de venta' },
  { value: 'bodega', label: 'Bodega' },
]

@Component({
  selector: 'mo-adjust-stock-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    DialogComponent,
    ButtonComponent,
    FormNumberInputComponent,
    FormSelectComponent,
    FormTextareaComponent,
    FormErrorComponent,
    DialogFooterComponent,
  ],
  template: `
    <mo-dialog
      [open]="open()"
      title="Ajustar stock"
      [description]="
        product()
          ? product()!.nombre + ' · PV ' + product()!.puntoVentaStock + ' · Bodega ' + product()!.bodegaStock
          : null
      "
      [busy]="saving()"
      (closed)="onClose()"
    >
      <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4">
        <mo-form-number-input
          controlName="cantidadDelta"
          label="Variación (+ entrada / − salida)"
          description="Ej: 5 para sumar, -3 para restar"
          [step]="1"
          [min]="null"
          [required]="true"
        />
        <mo-form-select
          controlName="ubicacion"
          label="Ubicacion"
          [required]="true"
          [options]="locationOptions"
          [placeholder]="null"
        />
        <mo-form-textarea
          controlName="motivo"
          label="Motivo"
          [required]="true"
          [rows]="3"
          placeholder="Conteo fisico, daño, perdida, etc."
        />

        <mo-form-error [message]="rootError()" />

        <mo-dialog-footer>
          <mo-button variant="outline" type="button" [disabled]="saving()" (click)="onClose()"
            >Cancelar</mo-button
          >
          <mo-button type="submit" [loading]="saving()" loadingText="Guardando..."
            >Guardar ajuste</mo-button
          >
        </mo-dialog-footer>
      </form>
    </mo-dialog>
  `,
})
export class AdjustStockDialog {
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
    cantidadDelta: new FormControl<number>(0, {
      nonNullable: true,
      validators: [Validators.required],
    }),
    ubicacion: new FormControl<InventoryLocation>('punto_venta', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    motivo: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3)],
    }),
  })

  constructor() {
    effect(() => {
      if (this.open()) {
        this.form.reset({ cantidadDelta: 0, ubicacion: 'punto_venta', motivo: '' })
        this.rootError.set(null)
      }
    })
  }

  async submit(): Promise<void> {
    if (this.saving()) return
    this.form.markAllAsTouched()
    if (this.form.invalid) return

    const value = this.form.getRawValue()
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
      const parsed = adjustStockSchema.safeParse({
        productId: product.id,
        cantidadDelta: Number(value.cantidadDelta),
        ubicacion: value.ubicacion,
        motivo: value.motivo.trim(),
      })
      if (!parsed.success) {
        this.rootError.set(parsed.error.issues[0]?.message ?? 'Datos de ajuste invalidos')
        return
      }
      await this.repo.adjustStock({
        tiendaId: auth.tiendaId,
        productId: product.id,
        cantidadDelta: parsed.data.cantidadDelta,
        ubicacion: parsed.data.ubicacion,
        motivo: parsed.data.motivo.trim(),
        createdBy: auth.userId,
      })
      this.toast.success('Ajuste registrado')
      this.saved.emit()
      this.closed.emit()
    } catch (error) {
      this.rootError.set(getErrorMessage(error, 'Error al ajustar stock'))
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
