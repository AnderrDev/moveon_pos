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
import { PROVEEDOR_NUEVO } from '@angular-app/features/products/presentation/forms/product-form.factory'
import type { Product, Categoria, Proveedor } from '@angular-app/features/products/domain/entities/product.entity'
import { ProductRepository, type ProductComponent, type ProductOption } from '@angular-app/features/products/domain/repositories/product.repository'
import { createProduct } from '@angular-app/features/products/domain/usecases/create-product.use-case'
import { updateProduct } from '@angular-app/features/products/domain/usecases/update-product.use-case'
import { createProveedor } from '@angular-app/features/products/domain/usecases/create-proveedor.use-case'
import { saveProductComponents } from '@angular-app/features/products/domain/usecases/save-product-components.use-case'
import { saveProductOptions } from '@angular-app/features/products/domain/usecases/save-product-options.use-case'
import { ProductsCacheStore } from '@angular-app/core/catalog/products-cache.store'
import {
  filterComboItemCandidates,
  filterComponentCandidates,
  filterOptionComponentCandidates,
} from '@angular-app/features/products/presentation/services/product-component.helpers'
import {
  comboSavings,
  sumComboItemCost,
} from '@angular-app/features/products/domain/services/combo-pricing'
import { SessionService } from '@angular-app/core/auth/session.service'
import { ToastService } from '@angular-app/shared/organisms/toast/toast.service'
import { ProductInitialStockSectionComponent } from '@angular-app/features/products/presentation/components/product-initial-stock-section.component'
import { ProductComponentsEditorComponent } from '@angular-app/features/products/presentation/components/product-components-editor.component'
import { ProductOptionsEditorComponent } from '@angular-app/features/products/presentation/components/product-options-editor.component'

const TIPO_OPTIONS: FormSelectOption<string>[] = [
  { value: 'simple', label: 'Simple' },
  { value: 'prepared', label: 'Preparado' },
  { value: 'ingredient', label: 'Ingrediente' },
  { value: 'combo', label: 'Combo' },
]

import { MoneyPipe } from '@angular-app/shared/pipes/money.pipe'
import { tracksOwnStock } from '@/shared/lib/product-type'
@Component({
  selector: 'mo-product-form-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ProductFormPresenter],
  imports: [
    MoneyPipe,
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
    ProductInitialStockSectionComponent,
    ProductComponentsEditorComponent,
    ProductOptionsEditorComponent,
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

        <mo-form-select
          controlName="proveedorId"
          label="Proveedor"
          placeholder="Sin proveedor"
          description="Se usa para filtrar el inventario y armar pedidos por proveedor."
          [options]="proveedorOptions()"
          [error]="presenter.errors().proveedorId ?? null"
        />
        @if (proveedorIdValue() === proveedorNuevoValue) {
          <mo-form-input
            controlName="proveedorNombreNuevo"
            label="Nombre del nuevo proveedor"
            placeholder="Ej. Distribuidora Healthy Sports"
            [required]="true"
            [error]="presenter.errors().proveedorNombreNuevo ?? null"
          />
        }

        <mo-product-image-field formControlName="imageUrl" [tiendaId]="tiendaId()" />
        <mo-form-error [message]="presenter.errors().imageUrl ?? null" />

        @if (!product()) {
          <mo-product-initial-stock-section
            [withoutOwnStock]="showComponents()"
            [isCombo]="isCombo()"
            [quantity]="presenter.form.controls.stockInicial.value"
            [quantityError]="presenter.errors().stockInicial ?? null"
            [locationError]="presenter.errors().stockInicialUbicacion ?? null"
          />
        }

        @if (showComponents()) {
          <mo-product-components-editor
            [isCombo]="isCombo()"
            [components]="components()"
            [candidates]="componentCandidates()"
            [savings]="savings()"
            [precioVenta]="precioVenta()"
            (added)="addComponent($event.componenteId, $event.cantidad)"
            (removed)="removeComponent($event)"
          />
        }

        <!-- Las opciones de venta (ADR 0017) son exclusivas de los preparados:
             un combo se vende tal cual, sin preguntar nada al cajero. -->
        @if (selectedType() === 'prepared') {
          <mo-product-options-editor
            [(options)]="options"
            [(grupo)]="optionGrupo"
            [(error)]="optionsError"
            [candidates]="optionComponentCandidates()"
          />
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
          @if (costLocked()) {
            <div>
              <p class="text-sm font-semibold">Costo</p>
              <p class="bg-muted/50 mt-1.5 flex h-10 items-center rounded-lg border px-3 text-sm font-semibold tabular-nums">
                {{ (product()!.costo! | money) }}
              </p>
              <p class="text-muted-foreground mt-1.5 text-xs">
                Cambia al registrar una entrada con costo o al corregir el costo de una entrada en el kardex.
              </p>
            </div>
          } @else {
            <mo-form-currency-input
              controlName="costo"
              label="Costo"
              [description]="comboCostHint()"
              [error]="presenter.errors().costo ?? null"
            />
          }
        </div>

        <div class="grid gap-x-4 gap-y-5 sm:grid-cols-2">
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
  private readonly repo = inject(ProductRepository)
  private readonly cache = inject(ProductsCacheStore)
  private readonly session = inject(SessionService)
  private readonly toast = inject(ToastService)

  readonly presenter = inject(ProductFormPresenter)
  readonly tipoOptions = TIPO_OPTIONS
  readonly selectedType = toSignal(this.presenter.form.controls.tipo.valueChanges, {
    initialValue: this.presenter.form.controls.tipo.value,
  })

  readonly open = input<boolean>(false)
  readonly product = input<Product | null>(null)
  readonly categorias = input<Categoria[]>([])
  readonly proveedores = input<Proveedor[]>([])

  readonly proveedorNuevoValue = PROVEEDOR_NUEVO
  readonly proveedorIdValue = toSignal(this.presenter.form.controls.proveedorId.valueChanges, {
    initialValue: this.presenter.form.controls.proveedorId.value,
  })

  readonly closed = output<void>()
  readonly saved = output<Product>()

  readonly saving = signal(false)
  readonly tiendaId = signal('')

  // --- Componentes consumibles ---
  readonly components = signal<ProductComponent[]>([])
  readonly allProducts = signal<Product[]>([])

  /**
   * Un combo incluye productos vendibles (proteína, shaker); un preparado
   * consume ingredientes (vaso). Son catálogos distintos a propósito.
   */
  readonly componentCandidates = computed(() => {
    const assigned = new Set(this.components().map((c) => c.componenteId))
    const selfId = this.product()?.id

    return this.isCombo()
      ? filterComboItemCandidates(this.allProducts(), assigned, selfId)
      : filterComponentCandidates(this.allProducts(), assigned, selfId)
  })
  // --------------------------------

  // --- Combos (ADR 0018) ---
  readonly isCombo = computed(() => this.selectedType() === 'combo')

  /** Preparados y combos comparten la sección de componentes; el copy cambia. */
  readonly showComponents = computed(
    () => this.isCombo() || this.selectedType() === 'prepared',
  )

  readonly precioVenta = toSignal(this.presenter.form.controls.precioVenta.valueChanges, {
    initialValue: this.presenter.form.controls.precioVenta.value,
  })

  /** Precio y costo de cada producto incluido, resueltos contra el catálogo. */
  private readonly comboItems = computed(() => {
    const byId = new Map(this.allProducts().map((p) => [p.id, p]))

    return this.components().flatMap((c) => {
      const product = byId.get(c.componenteId)
      return product
        ? [{ cantidad: c.cantidad, precioVenta: product.precioVenta, costo: product.costo }]
        : []
    })
  })

  /** Cuánto ahorra el cliente frente a comprar los productos sueltos. */
  readonly savings = computed(() => comboSavings(this.precioVenta(), this.comboItems()))

  /**
   * Productos incluidos sin costo registrado. Suman 0 al costo del combo, así
   * que el margen se vería mejor de lo que es y el dueño debe saberlo.
   */
  readonly comboItemsSinCosto = computed(() =>
    this.components().filter((c) => {
      const product = this.allProducts().find((p) => p.id === c.componenteId)
      return product ? product.costo === null : false
    }),
  )

  readonly comboCostHint = computed<string | null>(() => {
    if (!this.isCombo() || this.components().length === 0) return null

    const sinCosto = this.comboItemsSinCosto()
    if (sinCosto.length > 0) {
      const nombres = sinCosto.map((c) => c.componenteNombre).join(', ')
      return `Se calcula sumando el costo de los productos incluidos, pero ${nombres} no tiene costo registrado y suma $0. El margen se verá mejor de lo que es.`
    }

    return 'Se calcula solo sumando el costo de los productos incluidos. Puedes ajustarlo si el combo tiene un costo extra.'
  })
  // --------------------------

  // --- Opciones de venta (ADR 0017) ---
  readonly options = signal<ProductOption[]>([])
  readonly optionGrupo = signal('Proteína')
  readonly optionsError = signal<string | null>(null)

  readonly optionComponentCandidates = computed(() =>
    filterOptionComponentCandidates(this.allProducts(), this.product()?.id),
  )
  // ------------------------------------

  readonly categoriaOptions = computed<FormSelectOption<string>[]>(() =>
    this.categorias().map((c) => ({ value: c.id, label: c.nombre })),
  )

  readonly proveedorOptions = computed<FormSelectOption<string>[]>(() => [
    ...this.proveedores().map((p) => ({ value: p.id, label: p.nombre })),
    { value: PROVEEDOR_NUEVO, label: '+ Nuevo proveedor...' },
  ])

  /**
   * En un producto con stock propio y costo ya registrado, el costo solo
   * cambia por una entrada o una corrección de costo (ambas auditadas y
   * enlazadas a la compra). El control conserva el valor actual, así que el
   * guardado lo reenvía sin cambios.
   */
  readonly costLocked = computed(() => {
    const product = this.product()
    return (
      !!product &&
      product.costo !== null &&
      tracksOwnStock(product.tipo) &&
      tracksOwnStock(this.selectedType())
    )
  })

  readonly dialogTitle = computed(() => (this.product() ? 'Editar producto' : 'Nuevo producto'))

  constructor() {
    effect(() => {
      if (this.open()) {
        this.presenter.reset(productFormMapper.toFormValue(this.product()))
        this.components.set([])
        this.options.set([])
        this.optionGrupo.set('Proteína')
        this.optionsError.set(null)
        void this.initComponents()
      }
    })
    effect(() => {
      // Ni los preparados ni los combos controlan inventario propio: el RPC
      // rechaza el stock inicial, así que el formulario ni lo ofrece.
      if (this.showComponents()) {
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
    if (!product) return

    // Los combos también tienen componentes (los productos incluidos), pero las
    // opciones de venta siguen siendo exclusivas de los preparados (ADR 0017).
    if (product.tipo === 'combo') {
      this.components.set(await this.repo.getComponents(product.id, auth.tiendaId))
      // El costo guardado es una foto del momento en que se armó el combo. Al
      // abrirlo se refresca contra los costos actuales para que el dueño vea si
      // subió algún componente. El margen histórico no depende de esto: las
      // ventas ya guardaron su propio costo (ADR 0019).
      this.syncComboCost()
      return
    }

    if (product.tipo === 'prepared') {
      const [comps, options] = await Promise.all([
        this.repo.getComponents(product.id, auth.tiendaId),
        this.repo.getOptions(product.id, auth.tiendaId),
      ])
      this.components.set(comps)
      this.options.set(options)
      if (options.length > 0) this.optionGrupo.set(options[0].grupo)
    }
  }

  addComponent(componenteId: string, cantidad: number): void {
    if (!componenteId || cantidad <= 0) return
    const product = this.allProducts().find((p) => p.id === componenteId)
    if (!product) return
    this.components.update((prev) => [
      ...prev,
      { componenteId, componenteNombre: product.nombre, cantidad },
    ])
    this.syncComboCost()
  }

  removeComponent(componenteId: string): void {
    this.components.update((prev) => prev.filter((c) => c.componenteId !== componenteId))
    this.syncComboCost()
  }

  /**
   * El costo de un combo es lo que cuesta lo que consume, así que se recalcula
   * solo al cambiar los productos incluidos.
   *
   * Se dispara desde `addComponent`/`removeComponent` y NO desde un `effect`
   * a propósito: al abrir un combo existente el efecto pisaría el costo
   * guardado (que el dueño pudo haber ajustado a mano) apenas cargaran los
   * componentes. Así el valor guardado se respeta hasta que se toque la lista.
   */
  private syncComboCost(): void {
    if (!this.isCombo()) return
    // `costo` es opcional en el schema, así que el control es nullable en el tipo.
    this.presenter.form.controls.costo?.setValue(sumComboItemCost(this.comboItems()))
  }

  async submit(): Promise<void> {
    if (this.saving()) return
    let value = this.presenter.validate()
    if (!value) return

    const auth = await this.session.getAuthContext()
    if (!auth) {
      this.presenter.setRootError('Sesion expirada')
      return
    }

    this.saving.set(true)
    this.presenter.form.disable({ emitEvent: false })

    try {
      if (value.proveedorId === PROVEEDOR_NUEVO) {
        const proveedorResult = await createProveedor(
          { repo: this.repo },
          auth.tiendaId,
          { nombre: value.proveedorNombreNuevo },
        )
        if (!proveedorResult.ok) {
          this.presenter.setRootError(proveedorResult.error.message)
          return
        }
        this.cache.upsertProveedor(proveedorResult.value)
        value = { ...value, proveedorId: proveedorResult.value.id }
      }

      const product = this.product()
      const result = product
        ? await updateProduct(
            { repo: this.repo },
            product.id,
            auth.tiendaId,
            productFormMapper.toUpdatePayload(value),
          )
        : await createProduct(
            { repo: this.repo },
            productFormMapper.toCreatePayload(value, auth.tiendaId),
            { cantidad: value.stockInicial, ubicacion: value.stockInicialUbicacion },
          )

      if (!result.ok) {
        this.presenter.setRootError(result.error.message)
        return
      }
      const saved = result.value

      // Los productos incluidos de un combo se guardan igual que los
      // componentes de un preparado; las opciones de venta no aplican al combo.
      if (saved.tipo === 'prepared' || saved.tipo === 'combo') {
        const componentsResult = await saveProductComponents(
          { repo: this.repo },
          saved.id,
          auth.tiendaId,
          this.components().map((c) => ({ componenteId: c.componenteId, cantidad: c.cantidad })),
        )
        if (!componentsResult.ok) {
          this.presenter.setRootError(componentsResult.error.message)
          return
        }
      }

      if (saved.tipo === 'prepared') {
        const grupo = this.optionGrupo().trim() || 'Proteína'
        const optionsResult = await saveProductOptions(
          { repo: this.repo },
          saved.id,
          auth.tiendaId,
          this.options().map((option) => ({ ...option, grupo })),
        )
        if (!optionsResult.ok) {
          this.optionsError.set(optionsResult.error.message)
          this.presenter.setRootError(optionsResult.error.message)
          return
        }
      }

      this.toast.success(
        product
          ? 'Producto actualizado'
          : value.stockInicial > 0
            ? `Producto creado con ${value.stockInicial} unidades en inventario`
            : 'Producto creado',
      )
      this.saved.emit(saved)
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
