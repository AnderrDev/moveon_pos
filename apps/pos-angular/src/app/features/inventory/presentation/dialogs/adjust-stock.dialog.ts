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
import { AdjustStockFormPresenter } from '@angular-app/features/inventory/presentation/presenters/adjust-stock-form.presenter'
import { adjustStockFormMapper } from '@angular-app/features/inventory/presentation/forms/adjust-stock-form.mapper'
import { ReactiveFormsModule } from '@angular/forms'
import { DialogComponent } from '@angular-app/shared/organisms/dialog.component'
import { ButtonComponent } from '@angular-app/shared/atoms/button.component'
import { FormNumberInputComponent } from '@angular-app/shared/molecules/form-number-input.component'
import { FormSelectComponent, type FormSelectOption } from '@angular-app/shared/molecules/form-select.component'
import { FormTextareaComponent } from '@angular-app/shared/molecules/form-textarea.component'
import { FormErrorComponent } from '@angular-app/shared/molecules/form-error.component'
import { DialogFooterComponent } from '@angular-app/shared/molecules/dialog-footer.component'
import { InventoryRepository } from '@angular-app/features/inventory/domain/repositories/inventory.repository'
import { adjustStock } from '@angular-app/features/inventory/domain/usecases/adjust-stock.use-case'
import { SessionService } from '@angular-app/core/auth/session.service'
import { ToastService } from '@angular-app/shared/organisms/toast/toast.service'
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
  providers: [AdjustStockFormPresenter],
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
      <form [formGroup]="presenter.form" (ngSubmit)="submit()" class="space-y-4">
        <mo-form-number-input
          controlName="cantidadDelta"
          [error]="presenter.errors().cantidadDelta ?? null"
          label="Variación (+ entrada / − salida)"
          description="Ej: 5 para sumar, -3 para restar"
          [step]="1"
          [min]="null"
          [required]="true"
        />
        <mo-form-select
          controlName="ubicacion"
          [error]="presenter.errors().ubicacion ?? null"
          label="Ubicacion"
          [required]="true"
          [options]="locationOptions"
          [placeholder]="null"
        />
        <mo-form-textarea
          controlName="motivo"
          [error]="presenter.errors().motivo ?? null"
          label="Motivo"
          [required]="true"
          [rows]="3"
          placeholder="Conteo fisico, daño, perdida, etc."
        />

        <mo-form-error [message]="presenter.errors().root ?? null" />

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
  readonly presenter = inject(AdjustStockFormPresenter)

  readonly open = input<boolean>(false)
  readonly product = input<ProductSummary | null>(null)

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

    this.saving.set(true)
    this.presenter.form.disable({ emitEvent: false })

    try {
      const result = await adjustStock(
        { repo: this.repo, tiendaId: auth.tiendaId, createdBy: auth.userId },
        adjustStockFormMapper.toPayload(value, product.id),
      )
      if (!result.ok) {
        this.presenter.setRootError(result.error.message)
        return
      }
      this.toast.success('Ajuste registrado')
      this.saved.emit()
      this.closed.emit()
    } catch (error) {
      this.presenter.setRootError(getErrorMessage(error, 'Error al ajustar stock'))
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
