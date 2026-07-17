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
import { DialogComponent } from '@angular-app/shared/organisms/dialog.component'
import { ButtonComponent } from '@angular-app/shared/atoms/button.component'
import { FormInputComponent } from '@angular-app/shared/molecules/form-input.component'
import { FormCurrencyInputComponent } from '@angular-app/shared/molecules/form-currency-input.component'
import { FormNumberInputComponent } from '@angular-app/shared/molecules/form-number-input.component'
import { FormSelectComponent, type FormSelectOption } from '@angular-app/shared/molecules/form-select.component'
import { FormCheckboxComponent } from '@angular-app/shared/molecules/form-checkbox.component'
import { FormTextareaComponent } from '@angular-app/shared/molecules/form-textarea.component'
import { FormErrorComponent } from '@angular-app/shared/molecules/form-error.component'
import { DialogFooterComponent } from '@angular-app/shared/molecules/dialog-footer.component'
import { ProductFormPresenter } from '@angular-app/features/products/presentation/presenters/product-form.presenter'
import { ProductImageFieldComponent } from '@angular-app/features/products/presentation/components/product-image-field.component'
import { productFormMapper } from '@angular-app/features/products/presentation/forms/product-form.mapper'
import type { Product, Categoria } from '@angular-app/features/products/domain/entities/product.entity'
import { ProductsRepository } from '@angular-app/features/products/data/repositories/products.repository'
import type { ProductComponent } from '@angular-app/features/products/domain/repositories/product.repository'
import { ProductsCacheStore } from '@angular-app/features/products/presentation/services/products-cache.store'
import { filterComponentCandidates } from '@angular-app/features/products/presentation/services/product-component.helpers'
import { SessionService } from '@angular-app/core/auth/session.service'
import { ToastService } from '@angular-app/shared/organisms/toast/toast.service'
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
    DialogFooterComponent,
    ProductImageFieldComponent,
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

        <mo-form-input
          controlName="proveedor"
          label="Proveedor"
          placeholder="Ej. Distribuidora Healthy Sports"
          description="Se usa para filtrar el inventario y armar pedidos por proveedor."
          [error]="presenter.errors().proveedor ?? null"
        />

        <mo-product-image-field formControlName="imageUrl" [tiendaId]="tiendaId()" />
        <mo-form-error [message]="presenter.errors().imageUrl ?? null" />

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
                Los productos preparados no controlan stock propio. Asigna componentes consumibles abajo.
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

        @if (selectedType() === 'prepared') {
          <section class="rounded-xl border p-4 space-y-3">
            <div>
              <h3 class="text-sm font-semibold">Componentes consumibles</h3>
              <p class="text-muted-foreground mt-1 text-xs leading-relaxed">
                Al vender este batido se descuenta el stock de cada componente (ej. vaso, ingredientes).
              </p>
            </div>

            @for (comp of components(); track comp.componenteId) {
              <div class="border-border flex items-center gap-3 rounded-lg border px-3 py-2">
                <span class="min-w-0 flex-1 truncate text-sm font-medium">{{ comp.componenteNombre }}</span>
                <span class="text-muted-foreground shrink-0 text-xs tabular-nums">× {{ comp.cantidad }}</span>
                <button
                  type="button"
                  (click)="removeComponent(comp.componenteId)"
                  class="text-muted-foreground hover:text-destructive shrink-0 transition-colors"
                  aria-label="Quitar componente"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-4 w-4">
                    <path d="M18 6 6 18M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            }

            @if (components().length === 0) {
              <p class="text-muted-foreground text-xs">Sin componentes asignados.</p>
            }

            <div class="flex gap-2 items-end pt-1">
              <div class="flex-1 min-w-0">
                <label for="product-component-id" class="text-muted-foreground mb-1 block text-[11px] font-semibold uppercase tracking-wide">
                  Producto
                </label>
                <select
                  id="product-component-id"
                  [value]="pendingComponentId()"
                  (change)="pendingComponentId.set($any($event.target).value)"
                  class="border-input bg-background focus:ring-ring h-10 w-full rounded-lg border px-3 text-sm outline-none focus:ring-2"
                >
                  <option value="">Seleccionar...</option>
                  @for (p of componentCandidates(); track p.id) {
                    <option [value]="p.id">{{ p.nombre }}</option>
                  }
                </select>
              </div>
              <div class="w-24 shrink-0">
                <label for="product-component-qty" class="text-muted-foreground mb-1 block text-[11px] font-semibold uppercase tracking-wide">
                  Cantidad
                </label>
                <input
                  id="product-component-qty"
                  type="number"
                  min="0.001"
                  step="1"
                  [value]="pendingComponentQty()"
                  (input)="pendingComponentQty.set(+$any($event.target).value)"
                  class="border-input bg-background focus:ring-ring h-10 w-full rounded-lg border px-3 text-sm outline-none focus:ring-2"
                />
              </div>
              <button
                type="button"
                (click)="addComponent()"
                [disabled]="!pendingComponentId()"
                class="bg-primary text-primary-foreground disabled:opacity-40 h-10 shrink-0 rounded-lg px-3 text-sm font-semibold transition-opacity"
              >
                Agregar
              </button>
            </div>
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

        <mo-form-checkbox
          controlName="participaFidelizacion"
          label="Participa en MOVE ON Club (genera sellos y puede canjearse)"
        />

        <mo-form-checkbox controlName="isActive" label="Producto activo" />

        <mo-form-error [message]="presenter.errors().root ?? null" />

        <mo-dialog-footer>
          <mo-button variant="outline" type="button" [disabled]="saving()" (click)="onClose()">
            Cancelar
          </mo-button>
          <mo-button type="submit" [loading]="saving()" loadingText="Guardando...">
            {{ product() ? 'Guardar cambios' : 'Crear producto' }}
          </mo-button>
        </mo-dialog-footer>
      </form>
    </mo-dialog>
  `,
})
export class ProductFormDialog {
  private readonly repo = inject(ProductsRepository)
  private readonly cache = inject(ProductsCacheStore)
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
  readonly tiendaId = signal('')

  // --- Componentes consumibles ---
  readonly components = signal<ProductComponent[]>([])
  readonly allProducts = signal<Product[]>([])
  readonly pendingComponentId = signal('')
  readonly pendingComponentQty = signal(1)

  readonly componentCandidates = computed(() =>
    filterComponentCandidates(
      this.allProducts(),
      new Set(this.components().map((c) => c.componenteId)),
      this.product()?.id,
    ),
  )
  // --------------------------------

  readonly categoriaOptions = computed<FormSelectOption<string>[]>(() =>
    this.categorias().map((c) => ({ value: c.id, label: c.nombre })),
  )

  readonly dialogTitle = computed(() => (this.product() ? 'Editar producto' : 'Nuevo producto'))

  constructor() {
    effect(() => {
      if (this.open()) {
        this.presenter.reset(productFormMapper.toFormValue(this.product()))
        this.components.set([])
        this.pendingComponentId.set('')
        this.pendingComponentQty.set(1)
        void this.initComponents()
      }
    })
    effect(() => {
      if (this.selectedType() === 'prepared') {
        this.presenter.form.controls.stockInicial.setValue(0, { emitEvent: false })
      }
    })
  }

  private async initComponents(): Promise<void> {
    const auth = await this.session.getAuthContext()
    if (!auth) return
    this.tiendaId.set(auth.tiendaId)

    const all = await this.cache.ensureProducts(auth.tiendaId)
    this.allProducts.set(all)

    const product = this.product()
    if (product?.tipo === 'prepared') {
      const comps = await this.repo.getComponents(product.id, auth.tiendaId)
      this.components.set(comps)
    }
  }

  addComponent(): void {
    const id = this.pendingComponentId()
    const qty = this.pendingComponentQty()
    if (!id || qty <= 0) return
    const product = this.allProducts().find((p) => p.id === id)
    if (!product) return
    this.components.update((prev) => [
      ...prev,
      { componenteId: id, componenteNombre: product.nombre, cantidad: qty },
    ])
    this.pendingComponentId.set('')
    this.pendingComponentQty.set(1)
  }

  removeComponent(componenteId: string): void {
    this.components.update((prev) => prev.filter((c) => c.componenteId !== componenteId))
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

      if (result.tipo === 'prepared') {
        await this.repo.saveComponents(
          result.id,
          auth.tiendaId,
          this.components().map((c) => ({ componenteId: c.componenteId, cantidad: c.cantidad })),
        )
      }

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
