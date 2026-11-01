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
import { toSignal } from '@angular/core/rxjs-interop'
import { ReactiveFormsModule } from '@angular/forms'
import { getErrorMessage } from '@/shared/lib/error-message'
import { formatCurrency } from '@/shared/lib/format'
import type { InventoryLocation } from '@/shared/types'
import { DialogComponent } from '@angular-app/shared/organisms/dialog.component'
import { ButtonComponent } from '@angular-app/shared/atoms/button.component'
import { FormNumberInputComponent } from '@angular-app/shared/molecules/form-number-input.component'
import { FormSelectComponent, type FormSelectOption } from '@angular-app/shared/molecules/form-select.component'
import { FormInputComponent } from '@angular-app/shared/molecules/form-input.component'
import { FormErrorComponent } from '@angular-app/shared/molecules/form-error.component'
import { DialogFooterComponent } from '@angular-app/shared/molecules/dialog-footer.component'
import { SessionService } from '@angular-app/core/auth/session.service'
import { ToastService } from '@angular-app/shared/organisms/toast/toast.service'
import { InventoryRepository } from '@angular-app/features/inventory/domain/repositories/inventory.repository'
import { splitProduct } from '@angular-app/features/inventory/domain/usecases/split-product.use-case'
import { splitUnitCost } from '@angular-app/features/inventory/domain/dtos/inventory.dto'
import { SplitProductFormPresenter } from '@angular-app/features/inventory/presentation/presenters/split-product-form.presenter'
import { splitProductFormMapper } from '@angular-app/features/inventory/presentation/forms/split-product-form.mapper'

interface ProductSummary {
  id: string
  nombre: string
  costo: number | null
  puntoVentaStock: number
  bodegaStock: number
}

/** Producto candidato a destino (simple, con stock propio). */
export interface SplitTargetOption {
  id: string
  nombre: string
}

const LOCATION_OPTIONS: FormSelectOption<InventoryLocation>[] = [
  { value: 'punto_venta', label: 'Punto de venta' },
  { value: 'bodega', label: 'Bodega' },
]

/**
 * Fraccionar (PLAN-113): abrir un tarro para sacar sachets. No es compra ni
 * gasto: el costo del tarro se reparte entre las porciones y el stock de
 * ambos cambia en una sola transacción (RPC `split_product_atomic`).
 */
@Component({
  selector: 'mo-split-product-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [SplitProductFormPresenter],
  imports: [
    ReactiveFormsModule,
    DialogComponent,
    ButtonComponent,
    FormNumberInputComponent,
    FormSelectComponent,
    FormInputComponent,
    FormErrorComponent,
    DialogFooterComponent,
  ],
  template: `
    <mo-dialog
      [open]="open()"
      title="Fraccionar"
      [description]="
        product()
          ? 'Abres ' + product()!.nombre + ' para sacar porciones. No sale plata: el costo se reparte entre lo que salga.'
          : null
      "
      [busy]="saving()"
      width="md"
      (closed)="onClose()"
    >
      <form [formGroup]="presenter.form" (ngSubmit)="submit()" class="space-y-4">
        <div class="grid gap-4 sm:grid-cols-2">
          <mo-form-number-input
            controlName="cantidadOrigen"
            label="Cuántos abres"
            [description]="stockHint()"
            [step]="1"
            [min]="1"
            [required]="true"
            [error]="presenter.errors().cantidadOrigen ?? null"
          />
          <mo-form-select
            controlName="ubicacion"
            label="De dónde salen"
            [required]="true"
            [options]="locationOptions"
            [placeholder]="null"
            [error]="presenter.errors().ubicacion ?? null"
          />
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <mo-form-select
            controlName="destinoId"
            label="Producto que sale"
            [required]="true"
            [options]="targetOptions()"
            placeholder="Elige el sachet o porción"
            [error]="presenter.errors().destinoId ?? null"
          />
          <mo-form-number-input
            controlName="cantidadDestino"
            label="Cuántas porciones salen"
            description="Ej: 30 sachets de un tarro de 30 servicios"
            [step]="1"
            [min]="1"
            [required]="true"
            [error]="presenter.errors().cantidadDestino ?? null"
          />
        </div>

        <mo-form-input
          controlName="nota"
          label="Nota"
          placeholder="Opcional. Ej: se regaron 2 servicios"
          [maxLength]="200"
          [error]="presenter.errors().nota ?? null"
        />

        @if (product()?.costo; as costo) {
          <p class="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            {{ costSummary() }}
          </p>
        } @else {
          <p class="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Este producto no tiene costo registrado, así que no hay nada que repartir. Regístralo primero con una
            entrada con costo.
          </p>
        }

        <mo-form-error [message]="presenter.errors().root ?? null" />

        <mo-dialog-footer>
          <mo-button variant="outline" type="button" [disabled]="saving()" (click)="onClose()">Cancelar</mo-button>
          <mo-button type="submit" [loading]="saving()" loadingText="Guardando..." [disabled]="!product()?.costo">
            Fraccionar
          </mo-button>
        </mo-dialog-footer>
      </form>
    </mo-dialog>
  `,
})
export class SplitProductDialog {
  private readonly repo = inject(InventoryRepository)
  private readonly session = inject(SessionService)
  private readonly toast = inject(ToastService)
  readonly presenter = inject(SplitProductFormPresenter)

  readonly open = input<boolean>(false)
  /** El producto que se abre (origen). */
  readonly product = input<ProductSummary | null>(null)
  /** Productos simples que pueden recibir las porciones. */
  readonly targets = input<SplitTargetOption[]>([])

  readonly closed = output<void>()
  readonly saved = output<void>()

  readonly saving = signal(false)
  readonly locationOptions = LOCATION_OPTIONS

  private readonly formValue = toSignal(this.presenter.form.valueChanges, {
    initialValue: this.presenter.form.getRawValue(),
  })

  readonly targetOptions = computed<FormSelectOption<string>[]>(() =>
    this.targets()
      .filter((t) => t.id !== this.product()?.id)
      .map((t) => ({ value: t.id, label: t.nombre })),
  )

  readonly stockHint = computed(() => {
    const p = this.product()
    if (!p) return null
    return `Hay ${p.puntoVentaStock} en punto de venta y ${p.bodegaStock} en bodega`
  })

  readonly costSummary = computed(() => {
    const p = this.product()
    const v = this.formValue()
    if (!p?.costo) return ''
    const abre = Number(v.cantidadOrigen) || 0
    const salen = Number(v.cantidadDestino) || 0
    if (abre <= 0 || salen <= 0) {
      return `Cada unidad que abres costó ${formatCurrency(p.costo)}. Escribe cuántas porciones salen para ver el costo de cada una.`
    }
    const unit = splitUnitCost(p.costo, abre, salen)
    return `${formatCurrency(p.costo)} × ${abre} = ${formatCurrency(p.costo * abre)} repartidos en ${salen} porciones: cada una queda con costo ${formatCurrency(unit)}.`
  })

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
      this.presenter.setRootError('Sesión expirada')
      return
    }

    this.saving.set(true)
    this.presenter.form.disable({ emitEvent: false })
    try {
      const result = await splitProduct(
        { repo: this.repo, tiendaId: auth.tiendaId, createdBy: auth.userId },
        splitProductFormMapper.toPayload(value, product.id),
      )
      if (!result.ok) {
        this.presenter.setRootError(result.error.message)
        return
      }
      this.toast.success('Fraccionamiento registrado')
      this.saved.emit()
      this.closed.emit()
    } catch (error) {
      this.presenter.setRootError(getErrorMessage(error, 'Error al fraccionar'))
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
