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
import { getErrorMessage } from '@/shared/lib/error-message'
import { ReactiveFormsModule } from '@angular/forms'
import { DialogComponent } from '../../shared/ui/dialog.component'
import { ButtonComponent } from '../../shared/ui/button.component'
import { FormInputComponent } from '../../shared/forms/form-input.component'
import { FormCurrencyInputComponent } from '../../shared/forms/form-currency-input.component'
import { FormNumberInputComponent } from '../../shared/forms/form-number-input.component'
import { FormSelectComponent, type FormSelectOption } from '../../shared/forms/form-select.component'
import { FormCheckboxComponent } from '../../shared/forms/form-checkbox.component'
import { FormTextareaComponent } from '../../shared/forms/form-textarea.component'
import { FormErrorComponent } from '../../shared/forms/form-error.component'
import { ProductFormPresenter } from './product-form.presenter'
import { productFormMapper } from '@/modules/products/forms/product-form.mapper'
import type { Product, Categoria } from '@/modules/products/domain/entities/product.entity'
import { ProductsRepository } from './products.repository'
import { SessionService } from '../../core/auth/session.service'
import { ToastService } from '../../shared/feedback/toast.service'
import type { InventoryLocation } from '@/shared/types'

const TIPO_OPTIONS: FormSelectOption<string>[] = [
  { value: 'simple', label: 'Simple' },
  { value: 'prepared', label: 'Preparado' },
  { value: 'ingredient', label: 'Ingrediente' },
]

const IVA_OPTIONS: FormSelectOption<number>[] = [
  { value: 0, label: '0% (exento)' },
  { value: 5, label: '5%' },
  { value: 19, label: '19%' },
]

const INITIAL_STOCK_LOCATION_OPTIONS: FormSelectOption<InventoryLocation>[] = [
  { value: 'bodega', label: 'Bodega' },
  { value: 'punto_venta', label: 'Punto de venta' },
]

@Component({
  selector: 'mo-product-form-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ProductFormPresenter],
  imports: [
    ReactiveFormsModule,
    DialogComponent,
    ButtonComponent,
    FormInputComponent,
    FormCurrencyInputComponent,
    FormNumberInputComponent,
    FormSelectComponent,
    FormCheckboxComponent,
    FormTextareaComponent,
    FormErrorComponent,
  ],
  template: `
    <mo-dialog
      [open]="open()"
      [title]="dialogTitle()"
      [busy]="saving()"
      width="lg"
      (closed)="onClose()"
    >
      <form [formGroup]="presenter.form" (ngSubmit)="submit()" class="flex flex-col gap-5">
        <mo-form-input
          controlName="nombre"
          label="Nombre"
          [required]="true"
          [error]="presenter.errors().nombre ?? null"
        />

        <div class="grid gap-x-4 gap-y-5 sm:grid-cols-2">
          <mo-form-input
            controlName="sku"
            label="SKU"
            placeholder="WHY-001"
            [error]="presenter.errors().sku ?? null"
          />
          <mo-form-input
            controlName="codigoBarras"
            label="Codigo de barras"
            placeholder="7700000000001"
            [error]="presenter.errors().codigoBarras ?? null"
          />
        </div>

        <div class="grid gap-x-4 gap-y-5 sm:grid-cols-2">
          <mo-form-select
            controlName="categoriaId"
            label="Categoria"
            placeholder="Sin categoria"
            [options]="categoriaOptions()"
            [error]="presenter.errors().categoriaId ?? null"
          />
          <mo-form-select
            controlName="tipo"
            label="Tipo"
            [placeholder]="null"
            [options]="tipoOptions"
            [error]="presenter.errors().tipo ?? null"
          />
        </div>

        @if (!product()) {
          <section class="border-primary/20 bg-primary/[0.035] rounded-xl border p-4">
            <div>
              <h3 class="text-sm font-semibold">Inventario inicial</h3>
              <p class="text-muted-foreground mt-1 text-xs leading-relaxed">
                Opcional. Se registrará como una entrada de inventario auditada junto con el producto.
              </p>
            </div>

            @if (selectedType() === 'prepared') {
              <div class="border-border bg-card text-muted-foreground mt-4 rounded-lg border px-3.5 py-3 text-xs">
                Los productos preparados no controlan inventario. Su disponibilidad se maneja bajo pedido.
              </div>
            } @else {
              <div class="mt-4 grid gap-x-4 gap-y-5 sm:grid-cols-2">
                <mo-form-number-input
                  controlName="stockInicial"
                  label="Cantidad inicial"
                  [min]="0"
                  [step]="1"
                  description="Déjalo en 0 si registrarás la entrada después."
                  [error]="presenter.errors().stockInicial ?? null"
                />
                <mo-form-select
                  controlName="stockInicialUbicacion"
                  label="Ubicación inicial"
                  [placeholder]="null"
                  [options]="initialStockLocationOptions"
                  [error]="presenter.errors().stockInicialUbicacion ?? null"
                />
              </div>
              @if (presenter.form.controls.stockInicial.value > 0) {
                <p class="text-muted-foreground mt-3 text-[11px] leading-relaxed">
                  El costo unitario de la entrada será el costo registrado para el producto.
                </p>
              }
            }
          </section>
        }

        <div class="space-y-4 rounded-xl border p-4">
          <div>
            <h3 class="text-sm font-semibold">Información para recomendar</h3>
            <p class="text-muted-foreground mt-1 text-xs">
              Usa la ficha oficial del fabricante como fuente.
            </p>
          </div>
          <mo-form-textarea
            controlName="paraQueSirve"
            label="Para qué sirve"
            placeholder="Ej. Apoya la recuperación muscular y ayuda a completar la ingesta diaria de proteína."
            description="Resume la finalidad y los beneficios principales sin promesas médicas."
            [rows]="3"
            [error]="presenter.errors().paraQueSirve ?? null"
          />
          <mo-form-textarea
            controlName="recomendadoPara"
            label="A quién se recomienda"
            placeholder="Ej. Personas activas que buscan complementar su consumo diario de proteína."
            description="Describe el perfil de cliente adecuado y evita diagnósticos o prescripciones."
            [rows]="3"
            [error]="presenter.errors().recomendadoPara ?? null"
          />
        </div>

        <div class="grid gap-x-4 gap-y-5 sm:grid-cols-2">
          <mo-form-currency-input
            controlName="precioVenta"
            label="Precio de venta"
            [required]="true"
            [error]="presenter.errors().precioVenta ?? null"
          />
          <mo-form-currency-input
            controlName="costo"
            label="Costo"
            [error]="presenter.errors().costo ?? null"
          />
        </div>

        <div class="grid gap-x-4 gap-y-5 sm:grid-cols-3">
          <mo-form-select
            controlName="ivaTasa"
            label="IVA"
            [placeholder]="null"
            [options]="ivaOptions"
            [error]="presenter.errors().ivaTasa ?? null"
          />
          <mo-form-input
            controlName="unidad"
            label="Unidad"
            placeholder="und, kg, ml"
            [error]="presenter.errors().unidad ?? null"
          />
          <mo-form-number-input
            controlName="stockMinimo"
            label="Stock minimo"
            [min]="0"
            [error]="presenter.errors().stockMinimo ?? null"
          />
        </div>

        <mo-form-checkbox controlName="isActive" label="Producto activo" />

        <mo-form-error [message]="presenter.errors().root ?? null" />

        <div class="flex justify-end gap-2 pt-2">
          <mo-button variant="outline" type="button" [disabled]="saving()" (click)="onClose()">
            Cancelar
          </mo-button>
          <mo-button type="submit" [loading]="saving()" loadingText="Guardando...">
            {{ product() ? 'Guardar cambios' : 'Crear producto' }}
          </mo-button>
        </div>
      </form>
    </mo-dialog>
  `,
})
export class ProductFormDialog {
  private readonly repo = inject(ProductsRepository)
  private readonly session = inject(SessionService)
  private readonly toast = inject(ToastService)

  readonly presenter = inject(ProductFormPresenter)
  readonly tipoOptions = TIPO_OPTIONS
  readonly ivaOptions = IVA_OPTIONS
  readonly initialStockLocationOptions = INITIAL_STOCK_LOCATION_OPTIONS
  readonly selectedType = toSignal(this.presenter.form.controls.tipo.valueChanges, {
    initialValue: this.presenter.form.controls.tipo.value,
  })

  readonly open = input<boolean>(false)
  readonly product = input<Product | null>(null)
  readonly categorias = input<Categoria[]>([])

  readonly closed = output<void>()
  readonly saved = output<Product>()

  readonly saving = signal(false)

  readonly categoriaOptions = computed<FormSelectOption<string>[]>(() =>
    this.categorias().map((c) => ({ value: c.id, label: c.nombre })),
  )

  readonly dialogTitle = computed(() => (this.product() ? 'Editar producto' : 'Nuevo producto'))

  constructor() {
    effect(() => {
      if (this.open()) {
        this.presenter.reset(productFormMapper.toFormValue(this.product()))
      }
    })
    effect(() => {
      if (this.selectedType() === 'prepared') {
        this.presenter.form.controls.stockInicial.setValue(0, { emitEvent: false })
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
      const product = this.product()
      const result = product
        ? await this.repo.updateProduct(
            product.id,
            auth.tiendaId,
            productFormMapper.toUpdatePayload(value),
          )
        : await this.repo.createProduct(
            productFormMapper.toCreatePayload(value, auth.tiendaId),
            {
              cantidad: value.stockInicial,
              ubicacion: value.stockInicialUbicacion,
            },
          )

      this.toast.success(
        product
          ? 'Producto actualizado'
          : value.stockInicial > 0
            ? `Producto creado con ${value.stockInicial} unidades en inventario`
            : 'Producto creado',
      )
      this.saved.emit(result)
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
