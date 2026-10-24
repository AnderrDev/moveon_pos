import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core'
import { ReactiveFormsModule } from '@angular/forms'
import { getErrorMessage } from '@/shared/lib/error-message'
import { TransferStockFormPresenter } from '@angular-app/features/inventory/presentation/presenters/transfer-stock-form.presenter'
import { transferStockFormMapper } from '@angular-app/features/inventory/presentation/forms/transfer-stock-form.mapper'
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
  providers: [TransferStockFormPresenter],
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
      <form [formGroup]="presenter.form" (ngSubmit)="submit()" class="space-y-4">
        <div class="grid gap-3 sm:grid-cols-2">
          <mo-form-select
            controlName="fromUbicacion"
          [error]="presenter.errors().fromUbicacion ?? null"
            label="Origen"
            [required]="true"
            [options]="locationOptions"
            [placeholder]="null"
          />
          <mo-form-select
            controlName="toUbicacion"
          [error]="presenter.errors().toUbicacion ?? null"
            label="Destino"
            [required]="true"
            [options]="locationOptions"
            [placeholder]="null"
          />
        </div>

        <mo-form-number-input
          controlName="cantidad"
          [error]="presenter.errors().cantidad ?? null"
          label="Cantidad"
          [required]="true"
          [step]="1"
          [min]="1"
        />

        <mo-form-textarea
          controlName="motivo"
          [error]="presenter.errors().motivo ?? null"
          label="Motivo"
          [required]="true"
          [rows]="3"
          placeholder="Reposicion al punto de venta, conteo de bodega, etc."
        />

        <mo-form-error [message]="presenter.errors().root ?? null" />

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
  readonly presenter = inject(TransferStockFormPresenter)

  readonly open = input<boolean>(false)
  readonly product = input<ProductStockSummary | null>(null)

  readonly closed = output<void>()
  readonly saved = output<void>()

  readonly saving = signal(false)
  readonly locationOptions = LOCATION_OPTIONS

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

    const product = this.product()
    if (!product) return

    const auth = await this.session.getAuthContext()
    if (!auth) {
      this.presenter.setRootError('Sesion expirada')
      return
    }
    if (auth.rol !== 'admin') {
      this.presenter.setRootError('Solo el admin puede trasladar inventario')
      return
    }

    const available = this.stockFor(product, value.fromUbicacion)
    if (value.cantidad > available) {
      this.presenter.setRootError(`Stock insuficiente en origen. Disponible: ${available}`)
      return
    }

    this.saving.set(true)
    this.presenter.form.disable({ emitEvent: false })

    try {
      const result = await transferStock(
        { repo: this.repo, tiendaId: auth.tiendaId, createdBy: auth.userId },
        transferStockFormMapper.toPayload(value, product.id),
      )
      if (!result.ok) {
        this.presenter.setRootError(result.error.message)
        return
      }
      this.toast.success('Traslado registrado')
      this.saved.emit()
      this.closed.emit()
    } catch (error) {
      this.presenter.setRootError(getErrorMessage(error, 'Error al trasladar stock'))
    } finally {
      this.saving.set(false)
      this.presenter.form.enable({ emitEvent: false })
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
