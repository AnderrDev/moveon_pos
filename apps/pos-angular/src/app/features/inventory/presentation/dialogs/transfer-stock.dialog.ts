import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core'
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms'
import { getErrorMessage } from '@/shared/lib/error-message'
import { transferStockSchema } from '@angular-app/features/inventory/domain/dtos/inventory.dto'
import type { InventoryLocation } from '@/shared/types'
import { DialogComponent } from '@angular-app/shared/organisms/dialog.component'
import { ButtonComponent } from '@angular-app/shared/atoms/button.component'
import { FormNumberInputComponent } from '@angular-app/shared/molecules/form-number-input.component'
import { FormSelectComponent, type FormSelectOption } from '@angular-app/shared/molecules/form-select.component'
import { FormTextareaComponent } from '@angular-app/shared/molecules/form-textarea.component'
import { FormErrorComponent } from '@angular-app/shared/molecules/form-error.component'
import { DialogFooterComponent } from '@angular-app/shared/molecules/dialog-footer.component'
import { InventoryRepository } from '@angular-app/features/inventory/domain/repositories/inventory.repository'
import { transferStock } from '@angular-app/features/inventory/domain/usecases/transfer-stock.use-case'
import { SessionService } from '@angular-app/core/auth/session.service'
import { ToastService } from '@angular-app/shared/organisms/toast/toast.service'

interface ProductStockSummary {
  id: string
  nombre: string
  puntoVentaStock: number
  bodegaStock: number
}

const LOCATION_OPTIONS: FormSelectOption<InventoryLocation>[] = [
  { value: 'bodega', label: 'Bodega' },
  { value: 'punto_venta', label: 'Punto de venta' },
]

@Component({
  selector: 'mo-transfer-stock-dialog',
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
      title="Trasladar stock"
      [description]="
        product()
          ? product()!.nombre + ' · PV ' + product()!.puntoVentaStock + ' · Bodega ' + product()!.bodegaStock
          : null
      "
      [busy]="saving()"
      (closed)="onClose()"
    >
      <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4">
        <div class="grid gap-3 sm:grid-cols-2">
          <mo-form-select
            controlName="fromUbicacion"
            label="Origen"
            [required]="true"
            [options]="locationOptions"
            [placeholder]="null"
          />
          <mo-form-select
            controlName="toUbicacion"
            label="Destino"
            [required]="true"
            [options]="locationOptions"
            [placeholder]="null"
          />
        </div>

        <mo-form-number-input
          controlName="cantidad"
          label="Cantidad"
          [required]="true"
          [step]="1"
          [min]="1"
        />

        <mo-form-textarea
          controlName="motivo"
          label="Motivo"
          [required]="true"
          [rows]="3"
          placeholder="Reposicion al punto de venta, conteo de bodega, etc."
        />

        <mo-form-error [message]="rootError()" />

        <mo-dialog-footer>
          <mo-button variant="outline" type="button" [disabled]="saving()" (click)="onClose()"
            >Cancelar</mo-button
          >
          <mo-button type="submit" [loading]="saving()" loadingText="Trasladando..."
            >Trasladar</mo-button
          >
        </mo-dialog-footer>
      </form>
    </mo-dialog>
  `,
})
export class TransferStockDialog {
  private readonly repo = inject(InventoryRepository)
  private readonly session = inject(SessionService)
  private readonly toast = inject(ToastService)

  readonly open = input<boolean>(false)
  readonly product = input<ProductStockSummary | null>(null)

  readonly closed = output<void>()
  readonly saved = output<void>()

  readonly saving = signal(false)
  readonly rootError = signal<string | null>(null)
  readonly locationOptions = LOCATION_OPTIONS

  readonly form = new FormGroup({
    fromUbicacion: new FormControl<InventoryLocation>('bodega', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    toUbicacion: new FormControl<InventoryLocation>('punto_venta', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    cantidad: new FormControl<number>(1, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1)],
    }),
    motivo: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3)],
    }),
  })

  constructor() {
    effect(() => {
      if (this.open()) {
        this.form.reset({
          fromUbicacion: 'bodega',
          toUbicacion: 'punto_venta',
          cantidad: 1,
          motivo: '',
        })
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
    if (auth.rol !== 'admin') {
      this.rootError.set('Solo el admin puede trasladar inventario')
      return
    }

    const value = this.form.getRawValue()
    const parsed = transferStockSchema.safeParse({
      productId: product.id,
      fromUbicacion: value.fromUbicacion,
      toUbicacion: value.toUbicacion,
      cantidad: Number(value.cantidad),
      motivo: value.motivo.trim(),
    })
    if (!parsed.success) {
      this.rootError.set(parsed.error.issues[0]?.message ?? 'Datos de traslado invalidos')
      return
    }

    const available = this.stockFor(product, parsed.data.fromUbicacion)
    if (parsed.data.cantidad > available) {
      this.rootError.set(`Stock insuficiente en origen. Disponible: ${available}`)
      return
    }

    this.saving.set(true)
    this.form.disable({ emitEvent: false })

    try {
      const result = await transferStock(
        { repo: this.repo, tiendaId: auth.tiendaId, createdBy: auth.userId },
        {
          productId: product.id,
          fromUbicacion: parsed.data.fromUbicacion,
          toUbicacion: parsed.data.toUbicacion,
          cantidad: parsed.data.cantidad,
          motivo: parsed.data.motivo.trim(),
        },
      )
      if (!result.ok) {
        this.rootError.set(result.error.message)
        return
      }
      this.toast.success('Traslado registrado')
      this.saved.emit()
      this.closed.emit()
    } catch (error) {
      this.rootError.set(getErrorMessage(error, 'Error al trasladar stock'))
    } finally {
      this.saving.set(false)
      this.form.enable({ emitEvent: false })
    }
  }

  onClose(): void {
    if (this.saving()) return
    this.closed.emit()
  }

  private stockFor(product: ProductStockSummary, ubicacion: InventoryLocation): number {
    return ubicacion === 'bodega' ? product.bodegaStock : product.puntoVentaStock
  }
}
