import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core'
import { getErrorMessage } from '@/shared/lib/error-message'
import { NgTemplateOutlet } from '@angular/common'
import { RouterLink, RouterLinkActive } from '@angular/router'
import { LucideAngularModule, PackagePlus, Search } from 'lucide-angular'
import { SegmentedComponent, type SegmentedOption } from '@angular-app/shared/molecules/segmented.component'
import { PageHeaderComponent } from '@angular-app/shared/molecules/page-header.component'
import { ButtonComponent } from '@angular-app/shared/atoms/button.component'
import { BadgeComponent } from '@angular-app/shared/atoms/badge.component'
import { MO_MENU } from '@angular-app/shared/molecules/menu.component'
import { EmptyStateComponent } from '@angular-app/shared/molecules/empty-state.component'
import { ProductFormDialog } from '@angular-app/features/products/presentation/dialogs/product-form.dialog'
import { DialogComponent } from '@angular-app/shared/organisms/dialog.component'
import { TableShellComponent } from '@angular-app/shared/molecules/table/table-shell.component'
import { MO_TABLE } from '@angular-app/shared/molecules/table/table.directives'
import { ProductRepository } from '@angular-app/features/products/domain/repositories/product.repository'
import { deleteProduct } from '@angular-app/features/products/domain/usecases/delete-product.use-case'
import { deactivateProduct } from '@angular-app/features/products/domain/usecases/deactivate-product.use-case'
import { ProductsCacheStore } from '@angular-app/core/catalog/products-cache.store'
import { InventoryRepository } from '@angular-app/features/inventory/domain/repositories/inventory.repository'
import { SessionService } from '@angular-app/core/auth/session.service'
import { ToastService } from '@angular-app/shared/organisms/toast/toast.service'
import type { Product } from '@angular-app/features/products/domain/entities/product.entity'
import type { StockLevel } from '@angular-app/features/inventory/domain/entities/inventory.entity'
import { RegisterEntryDialog } from '@angular-app/features/inventory/presentation/dialogs/register-entry.dialog'
import { AdjustStockDialog } from '@angular-app/features/inventory/presentation/dialogs/adjust-stock.dialog'
import { TransferStockDialog } from '@angular-app/features/inventory/presentation/dialogs/transfer-stock.dialog'
import {
  KardexDialog,
  type EntryCostCorrectionRequest,
} from '@angular-app/features/inventory/presentation/dialogs/kardex.dialog'
import { CorrectEntryCostDialog } from '@angular-app/features/inventory/presentation/dialogs/correct-entry-cost.dialog'
import {
  buildProductStock,
  countProductViews,
  marginPercent,
  matchesProductView,
  type ProductStock,
  type ProductView,
} from '@angular-app/features/products/presentation/services/product-stock'
import { ExcelExportService } from '@angular-app/shared/services/export/excel-export.service'
import { buildProductsWorkbook } from '@angular-app/features/products/presentation/services/product-export'
import { MoneyPipe } from '@angular-app/shared/pipes/money.pipe'
import { formatCurrency } from '@/shared/lib/format'
import { SkeletonComponent } from '@angular-app/shared/atoms/skeleton.component'

@Component({
  selector: 'mo-productos-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SkeletonComponent, MoneyPipe,
    NgTemplateOutlet,
    LucideAngularModule,
    SegmentedComponent,
    RouterLink,
    RouterLinkActive,
    PageHeaderComponent,
    ButtonComponent,
    BadgeComponent,
    EmptyStateComponent,
    ProductFormDialog,
    DialogComponent,
    TableShellComponent,
    MO_TABLE,
    ...MO_MENU,
    RegisterEntryDialog,
    AdjustStockDialog,
    TransferStockDialog,
    KardexDialog,
    CorrectEntryCostDialog,
  ],
  template: `
    <section class="flex h-full min-h-0 flex-col gap-4">
      <mo-page-header title="Productos" [subtitle]="headerSubtitle()">
        <mo-button (click)="openCreate()">Nuevo producto</mo-button>
        <mo-menu>
          <button
            type="button"
            moMenuItem
            [disabled]="exporting() || filteredProducts().length === 0"
            (click)="exportProducts()"
          >
            {{ exporting() ? 'Generando Excel…' : 'Descargar Excel' }}
          </button>
        </mo-menu>
      </mo-page-header>

      <nav class="flex gap-6 border-b text-sm" aria-label="Secciones de productos">
        <a
          routerLink="/productos"
          routerLinkActive="border-primary! text-foreground!"
          [routerLinkActiveOptions]="{ exact: true }"
          class="text-muted-foreground hover:text-foreground -mb-px border-b-[3px] border-transparent pt-1 pb-2.5 font-semibold transition-colors"
          >Productos</a
        >
        <a
          routerLink="/productos/categorias"
          routerLinkActive="border-primary! text-foreground!"
          class="text-muted-foreground hover:text-foreground -mb-px border-b-[3px] border-transparent pt-1 pb-2.5 font-semibold transition-colors"
          >Categorías</a
        >
      </nav>

      <div class="flex flex-col gap-3">
        <mo-segmented [options]="viewOptions()" [value]="view()" (valueChange)="setView($event)" />

        <div class="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2 lg:flex">
          <label class="relative col-span-2 block lg:min-w-0 lg:flex-1">
            <span class="sr-only">Buscar producto</span>
            <span class="text-muted-foreground pointer-events-none absolute inset-y-0 left-3 flex items-center" aria-hidden="true">
              <lucide-angular [img]="icons.search" class="h-4 w-4" />
            </span>
            <input
              type="search"
              [value]="query()"
              (input)="onQueryInput($event)"
              placeholder="Buscar por nombre, SKU o código de barras"
              class="border-input bg-card focus:border-foreground h-10 w-full rounded-lg border pr-3 pl-9 text-sm outline-none"
            />
          </label>
          <select
            [value]="filterCategoria()"
            (change)="filterCategoria.set(getSelectValue($event))"
            class="border-input bg-card focus:border-foreground h-10 w-full min-w-0 rounded-lg border px-3 text-sm outline-none lg:w-52"
            aria-label="Filtrar por categoría"
          >
            <option value="all">Todas las categorías</option>
            @for (cat of categorias(); track cat.id) {
              <option [value]="cat.id">{{ cat.nombre }}</option>
            }
          </select>
          <select
            [value]="filterProveedor()"
            (change)="filterProveedor.set(getSelectValue($event))"
            class="border-input bg-card focus:border-foreground h-10 w-full min-w-0 rounded-lg border px-3 text-sm outline-none lg:w-52"
            aria-label="Filtrar por proveedor"
          >
            <option value="all">Todos los proveedores</option>
            @for (prov of proveedores(); track prov.id) {
              <option [value]="prov.id">{{ prov.nombre }}</option>
            }
            <option value="__sin__">Sin proveedor</option>
          </select>
        </div>
      </div>

      @if (loading()) {
        <mo-skeleton heightClass="h-72" />
      } @else if (loadError()) {
        <mo-empty-state title="No se pudo cargar el catálogo" [description]="loadError()">
          <mo-button (click)="load()">Reintentar</mo-button>
        </mo-empty-state>
      } @else if (filteredProducts().length === 0) {
        @if (products().length === 0) {
          <mo-empty-state
            title="Aún no hay productos"
            description="Crea tu primer producto para empezar a vender."
          >
            <mo-button (click)="openCreate()">Nuevo producto</mo-button>
          </mo-empty-state>
        } @else if (view() === 'restock' && !hasNarrowingFilters()) {
          <mo-empty-state
            title="Nada por reponer"
            description="Todos los productos activos están por encima de su stock mínimo."
          />
        } @else {
          <mo-empty-state
            title="Ningún producto coincide"
            description="Cambia la búsqueda, la categoría o el proveedor."
          >
            <mo-button variant="outline" (click)="clearFilters()">Limpiar filtros</mo-button>
          </mo-empty-state>
        }
      } @else {
        <!-- Escritorio: tabla -->
        <mo-table-shell class="hidden flex-1 md:block">
          <table moTable>
            <thead moThead>
              <tr>
                <th moTh>Producto</th>
                <th moTh class="text-right">Precio</th>
                <th moTh>Stock en punto de venta</th>
                <th moTh class="w-px"><span class="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody class="divide-y">
              @for (product of filteredProducts(); track product.id) {
                @let stock = stockOf(product);
                @let margin = marginOf(product);
                <tr moTr [hover]="true">
                  <td moTd>
                    <div class="flex items-center gap-3">
                      <ng-container *ngTemplateOutlet="thumb; context: { $implicit: product }" />
                      <div class="min-w-0">
                        <div class="flex items-center gap-2">
                          <span class="font-semibold">{{ product.nombre }}</span>
                          @if (!product.isActive) {
                            <mo-badge variant="outline">Inactivo</mo-badge>
                          }
                        </div>
                        <div class="text-muted-foreground mt-0.5 truncate text-xs">{{ productMeta(product) }}</div>
                      </div>
                    </div>
                  </td>
                  <td moTd class="text-right whitespace-nowrap">
                    <div class="font-display font-extrabold tabular-nums">{{ (product.precioVenta | money) }}</div>
                    <div class="text-muted-foreground mt-0.5 text-xs tabular-nums">
                      @if (product.costo !== null) {
                        Costo {{ (product.costo | money) }}
                        @if (margin !== null) {
                          · margen {{ margin }}%
                        }
                      } @else {
                        Sin costo registrado
                      }
                    </div>
                  </td>
                  <td moTd>
                    <ng-container *ngTemplateOutlet="stockCell; context: { $implicit: product, stock: stock }" />
                  </td>
                  <td moTd>
                    <ng-container *ngTemplateOutlet="actions; context: { $implicit: product, stock: stock }" />
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </mo-table-shell>

        <!-- Móvil: tarjetas -->
        <ul class="space-y-2 md:hidden">
          @for (product of filteredProducts(); track product.id) {
            @let stock = stockOf(product);
            <li class="bg-card rounded-xl border p-3">
              <div class="flex items-start gap-3">
                <ng-container *ngTemplateOutlet="thumb; context: { $implicit: product }" />
                <div class="min-w-0 flex-1">
                  <div class="flex items-start justify-between gap-2">
                    <p class="leading-snug font-semibold">{{ product.nombre }}</p>
                    <p class="font-display shrink-0 font-extrabold tabular-nums">{{ (product.precioVenta | money) }}</p>
                  </div>
                  <p class="text-muted-foreground mt-0.5 text-xs">{{ productMeta(product) }}</p>
                  <div class="mt-2">
                    <ng-container *ngTemplateOutlet="stockCell; context: { $implicit: product, stock: stock }" />
                  </div>
                </div>
              </div>
              <div class="mt-3 border-t pt-3">
                <ng-container *ngTemplateOutlet="actions; context: { $implicit: product, stock: stock }" />
              </div>
            </li>
          }
        </ul>
      }
    </section>

    <ng-template #thumb let-product>
      @if (product.imageUrl) {
        <img
          [src]="product.imageUrl"
          alt=""
          class="bg-muted h-11 w-11 shrink-0 rounded-lg border object-cover"
          loading="lazy"
        />
      } @else {
        <span
          class="bg-muted text-muted-foreground font-display flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-sm font-extrabold"
          aria-hidden="true"
        >
          {{ product.nombre.slice(0, 1).toUpperCase() }}
        </span>
      }
    </ng-template>

    <ng-template #stockCell let-product let-stock="stock">
      @if (stock.tracksStock) {
        <div class="flex items-center gap-2">
          <span
            class="font-display text-lg leading-none font-extrabold tabular-nums"
            [class.text-destructive]="stock.isOut"
          >
            {{ stock.puntoVentaStock }}
          </span>
          @if (stock.isOut) {
            <mo-badge variant="destructive">Agotado</mo-badge>
          } @else if (stock.isLow) {
            <mo-badge variant="warning">Stock bajo</mo-badge>
          }
        </div>
        <div class="text-muted-foreground mt-1 text-xs tabular-nums">
          Bodega {{ stock.bodegaStock }} · mínimo {{ product.stockMinimo }}
        </div>
      } @else {
        <span class="text-muted-foreground text-xs">{{ noStockLabel(product) }}</span>
      }
    </ng-template>

    <ng-template #actions let-product let-stock="stock">
      <div class="flex items-center justify-end gap-1.5">
        @if (canMoveStock(product)) {
          <mo-button size="sm" variant="outline" (click)="openEntry(product)">
            <span class="flex items-center gap-1.5 whitespace-nowrap">
              <lucide-angular [img]="icons.entry" class="h-4 w-4" aria-hidden="true" />
              Entrada
            </span>
          </mo-button>
        }
        <mo-button size="sm" variant="outline" (click)="openEdit(product)">Editar</mo-button>
        <mo-menu size="sm" [label]="'Más acciones para ' + product.nombre">
          @if (canMoveStock(product)) {
            <button type="button" moMenuItem (click)="openAdjust(product)">Ajustar stock</button>
            <button type="button" moMenuItem (click)="openTransfer(product)">Trasladar entre bodega y punto de venta</button>
          }
          @if (stock.tracksStock) {
            <button type="button" moMenuItem (click)="openKardex(product)">Ver movimientos (kardex)</button>
          }
          @if (product.isActive) {
            <button type="button" moMenuItem (click)="confirmDeactivate(product)">Desactivar</button>
          }
          <button type="button" moMenuItem class="text-destructive" (click)="openDeleteConfirm(product)">
            Eliminar
          </button>
        </mo-menu>
      </div>
    </ng-template>

    <mo-register-entry-dialog
      [open]="entryOpen()"
      [product]="stockTarget()"
      (closed)="entryOpen.set(false)"
      (saved)="onStockChanged({ costChanged: true })"
    />

    <mo-adjust-stock-dialog
      [open]="adjustOpen()"
      [product]="stockTarget()"
      (closed)="adjustOpen.set(false)"
      (saved)="onStockChanged()"
    />

    <mo-transfer-stock-dialog
      [open]="transferOpen()"
      [product]="stockTarget()"
      (closed)="transferOpen.set(false)"
      (saved)="onStockChanged()"
    />

    <mo-kardex-dialog
      [open]="kardexOpen()"
      [product]="stockTarget()"
      (closed)="kardexOpen.set(false)"
      (correctCostRequested)="openCostCorrection($event)"
    />

    <mo-correct-entry-cost-dialog
      [open]="costCorrection() !== null"
      [movement]="costCorrection()?.movement ?? null"
      [isLatestEntry]="costCorrection()?.isLatestEntry ?? false"
      [product]="stockTarget()"
      (closed)="costCorrection.set(null)"
      (saved)="onStockChanged({ costChanged: true })"
    />

    <mo-product-form-dialog
      [open]="dialogOpen()"
      [product]="editingProduct()"
      [categorias]="categorias()"
      [proveedores]="proveedores()"
      (closed)="closeDialog()"
      (saved)="onSaved($event)"
    />

    <mo-dialog
      title="Eliminar producto"
      width="sm"
      [open]="deleteConfirmOpen()"
      [busy]="deleting()"
      (closed)="closeDeleteConfirm()"
    >
      @if (deletingProduct()) {
        <div class="flex flex-col gap-4">
          <p class="text-sm">
            Esta acción ocultará el producto permanentemente. El historial de ventas se conserva.
          </p>
          <p class="text-sm font-medium">
            Escribe <span class="text-destructive font-semibold">{{ deletingProduct()!.nombre }}</span> para confirmar:
          </p>
          <input
            type="text"
            [value]="deleteConfirmInput()"
            (input)="deleteConfirmInput.set(getInputValue($event))"
            placeholder="Nombre del producto"
            class="border-input bg-card focus:ring-ring h-10 w-full rounded-lg border px-3 text-sm focus:ring-2 focus:outline-none"
          />
          <div class="flex justify-end gap-2 pt-1">
            <mo-button variant="outline" [disabled]="deleting()" (click)="closeDeleteConfirm()">
              Cancelar
            </mo-button>
            <mo-button
              variant="destructive"
              [disabled]="deleteConfirmInput() !== deletingProduct()!.nombre || deleting()"
              [loading]="deleting()"
              loadingText="Eliminando..."
              (click)="executeDelete()"
            >
              Eliminar
            </mo-button>
          </div>
        </div>
      }
    </mo-dialog>
  `,
})
export class ProductosPage {
  private readonly repo = inject(ProductRepository)
  private readonly store = inject(ProductsCacheStore)
  private readonly inventoryRepo = inject(InventoryRepository)
  private readonly session = inject(SessionService)
  private readonly toast = inject(ToastService)
  private readonly excel = inject(ExcelExportService)

  readonly products = computed(() => this.store.products() ?? [])
  readonly categorias = computed(() => this.store.categorias() ?? [])
  readonly proveedores = computed(() => this.store.activeProveedores())
  readonly stockLevels = signal<StockLevel[]>([])
  readonly loading = signal(true)
  readonly loadError = signal<string | null>(null)
  readonly query = signal('')
  readonly dialogOpen = signal(false)
  readonly editingProduct = signal<Product | null>(null)
  readonly exporting = signal(false)

  /** Stock por producto: una sola pasada por render en vez de buscar en cada celda. */
  readonly stockById = computed(() => {
    const levels = new Map(this.stockLevels().map((s) => [s.productId, s]))
    return new Map(this.products().map((p) => [p.id, buildProductStock(p, levels.get(p.id))]))
  })

  readonly icons = { entry: PackagePlus, search: Search }

  /** Vista rápida (Activos / Por reponer / Inactivos / Todos); reemplaza el select de estado y "Solo faltantes". */
  readonly view = signal<ProductView>('active')

  readonly viewCounts = computed(() => countProductViews(this.products(), this.stockById()))

  readonly viewOptions = computed<SegmentedOption[]>(() => {
    const counts = this.viewCounts()
    return [
      { value: 'active', label: `Activos ${counts.active}` },
      { value: 'restock', label: `Por reponer ${counts.restock}` },
      { value: 'inactive', label: `Inactivos ${counts.inactive}` },
      { value: 'all', label: `Todos ${counts.all}` },
    ]
  })

  /** Valor del inventario a costo: stock total × costo de los activos con stock propio. */
  readonly inventoryValue = computed(() => {
    const stockById = this.stockById()
    return this.products().reduce((sum, p) => {
      const stock = stockById.get(p.id)
      if (!p.isActive || !stock?.tracksStock || p.costo === null) return sum
      return sum + Math.max(stock.totalStock, 0) * p.costo
    }, 0)
  })

  readonly headerSubtitle = computed(() => {
    const active = this.viewCounts().active
    const value = this.inventoryValue()
    const base = `${active} ${active === 1 ? 'producto activo' : 'productos activos'}`
    return value > 0 ? `${base} · inventario a costo ${formatCurrency(value)}` : base
  })

  readonly hasNarrowingFilters = computed(
    () => this.query().trim() !== '' || this.filterCategoria() !== 'all' || this.filterProveedor() !== 'all',
  )

  // --- Diálogos de stock (antes en /inventario) ---
  readonly entryOpen = signal(false)
  readonly adjustOpen = signal(false)
  readonly transferOpen = signal(false)
  readonly kardexOpen = signal(false)
  readonly costCorrection = signal<EntryCostCorrectionRequest | null>(null)
  readonly stockProduct = signal<Product | null>(null)

  /** Lo que necesitan los diálogos de inventario del producto elegido. */
  readonly stockTarget = computed(() => {
    const product = this.stockProduct()
    if (!product) return null
    const stock = this.stockById().get(product.id)
    return {
      id: product.id,
      nombre: product.nombre,
      costo: product.costo,
      puntoVentaStock: stock?.puntoVentaStock ?? 0,
      bodegaStock: stock?.bodegaStock ?? 0,
    }
  })
  // -------------------------------------------------

  readonly filterCategoria = signal<string>('all')
  readonly filterProveedor = signal<string>('all')
  readonly deleteConfirmOpen = signal(false)
  readonly deletingProduct = signal<Product | null>(null)
  readonly deleteConfirmInput = signal('')
  readonly deleting = signal(false)

  readonly filteredProducts = computed(() => {
    const q = this.query().trim().toLowerCase()
    const cat = this.filterCategoria()
    const prov = this.filterProveedor()
    const view = this.view()
    const stockById = this.stockById()
    return this.products().filter((p) => {
      if (q && !([p.nombre, p.sku ?? '', p.codigoBarras ?? ''].join(' ').toLowerCase().includes(q))) return false
      if (cat !== 'all' && p.categoriaId !== cat) return false
      if (prov === '__sin__' && p.proveedorId) return false
      if (prov !== 'all' && prov !== '__sin__' && p.proveedorId !== prov) return false
      return matchesProductView(p, stockById.get(p.id) ?? buildProductStock(p, undefined), view)
    })
  })

  constructor() {
    void this.load()
  }


  tipoLabel(tipo: string): string {
    const labels: Record<string, string> = {
      simple: 'Simple',
      prepared: 'Preparado',
      ingredient: 'Ingrediente',
      combo: 'Combo',
    }
    return labels[tipo] ?? tipo
  }

  stockOf(product: Product): ProductStock {
    return this.stockById().get(product.id) ?? buildProductStock(product, undefined)
  }

  /** Entradas, ajustes y traslados: solo productos activos con stock propio (la RPC rechaza el resto). */
  canMoveStock(product: Product): boolean {
    return product.isActive && this.stockOf(product).tracksStock
  }

  marginOf(product: Product): number | null {
    return marginPercent(product.precioVenta, product.costo)
  }

  /** Preparados y combos: su stock sale de los ingredientes o productos incluidos. */
  noStockLabel(product: Product): string {
    return product.tipo === 'combo' ? 'Según los productos incluidos' : 'Se prepara al vender'
  }

  setView(value: string): void {
    if (value === 'active' || value === 'restock' || value === 'inactive' || value === 'all') {
      this.view.set(value)
    }
  }

  clearFilters(): void {
    this.query.set('')
    this.filterCategoria.set('all')
    this.filterProveedor.set('all')
  }

  categoriaName(id: string | null): string | null {
    if (!id) return null
    return this.categorias().find((c) => c.id === id)?.nombre ?? null
  }

  /** Línea secundaria: tipo (si no es simple) · categoría · SKU · proveedor, lo que exista. */
  productMeta(product: Product): string {
    const tipo = product.tipo === 'simple' ? null : this.tipoLabel(product.tipo)
    return [tipo, this.categoriaName(product.categoriaId), product.sku, product.proveedorNombre]
      .filter((part): part is string => !!part)
      .join(' · ')
  }

  openEntry(product: Product): void {
    this.stockProduct.set(product)
    this.entryOpen.set(true)
  }

  openAdjust(product: Product): void {
    this.stockProduct.set(product)
    this.adjustOpen.set(true)
  }

  openTransfer(product: Product): void {
    this.stockProduct.set(product)
    this.transferOpen.set(true)
  }

  openKardex(product: Product): void {
    this.stockProduct.set(product)
    this.kardexOpen.set(true)
  }

  openCostCorrection(request: EntryCostCorrectionRequest): void {
    this.kardexOpen.set(false)
    this.costCorrection.set(request)
  }

  /**
   * Tras mover stock se releen los niveles; una entrada con costo o una
   * corrección también cambian `productos.costo`, así que se refresca el
   * catálogo.
   */
  async onStockChanged(options: { costChanged?: boolean } = {}): Promise<void> {
    try {
      const auth = await this.session.getAuthContext()
      if (!auth) return
      const [stockLevels] = await Promise.all([
        this.inventoryRepo.getStockLevels(auth.tiendaId),
        options.costChanged ? this.store.ensureProducts(auth.tiendaId, { force: true }) : Promise.resolve(),
      ])
      this.stockLevels.set(stockLevels)
    } catch (error) {
      this.toast.error(getErrorMessage(error, 'No se pudo actualizar el stock'))
    }
  }

  onQueryInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value)
  }

  getSelectValue(event: Event): string {
    return (event.target as HTMLSelectElement).value
  }

  getInputValue(event: Event): string {
    return (event.target as HTMLInputElement).value
  }

  openDeleteConfirm(product: Product): void {
    this.deletingProduct.set(product)
    this.deleteConfirmInput.set('')
    this.deleteConfirmOpen.set(true)
  }

  closeDeleteConfirm(): void {
    this.deleteConfirmOpen.set(false)
    this.deletingProduct.set(null)
    this.deleteConfirmInput.set('')
  }

  async executeDelete(): Promise<void> {
    const product = this.deletingProduct()
    if (!product || this.deleteConfirmInput() !== product.nombre) return
    const auth = await this.session.getAuthContext()
    if (!auth) return
    this.deleting.set(true)
    try {
      const result = await deleteProduct({ repo: this.repo }, product.id, auth.tiendaId)
      if (!result.ok) {
        this.toast.error(result.error.message)
        return
      }
      this.store.removeProduct(product.id)
      this.toast.success(`"${product.nombre}" eliminado`)
      this.closeDeleteConfirm()
    } catch (error) {
      this.toast.error(getErrorMessage(error, 'No se pudo eliminar el producto'))
    } finally {
      this.deleting.set(false)
    }
  }

  async exportProducts(): Promise<void> {
    this.exporting.set(true)
    try {
      await this.excel.download(
        buildProductsWorkbook(this.filteredProducts(), this.categorias(), this.query(), this.stockById())
      )
      this.toast.success('Archivo de productos descargado')
    } catch (error) {
      this.toast.error(getErrorMessage(error, 'No se pudo generar el archivo'))
    } finally {
      this.exporting.set(false)
    }
  }

  async load(options: { force?: boolean } = {}): Promise<void> {
    this.loading.set(true)
    this.loadError.set(null)
    try {
      const auth = await this.session.getAuthContext()
      if (!auth) throw new Error('No autenticado')
      const [, , , stockLevels] = await Promise.all([
        this.store.ensureProducts(auth.tiendaId, { force: options.force }),
        this.store.ensureCategorias(auth.tiendaId, { force: options.force }),
        this.store.ensureProveedores(auth.tiendaId, { force: options.force }),
        this.inventoryRepo.getStockLevels(auth.tiendaId),
      ])
      this.stockLevels.set(stockLevels)
    } catch (error) {
      this.loadError.set(getErrorMessage(error, 'Error al cargar productos'))
    } finally {
      this.loading.set(false)
    }
  }

  openCreate(): void {
    this.editingProduct.set(null)
    this.dialogOpen.set(true)
  }

  openEdit(product: Product): void {
    this.editingProduct.set(product)
    this.dialogOpen.set(true)
  }

  closeDialog(): void {
    this.dialogOpen.set(false)
    this.editingProduct.set(null)
  }

  onSaved(product: Product): void {
    this.store.upsertProduct(product)
  }

  async confirmDeactivate(product: Product): Promise<void> {
    if (!window.confirm(`¿Desactivar "${product.nombre}"?`)) return
    const auth = await this.session.getAuthContext()
    if (!auth) return
    try {
      const result = await deactivateProduct({ repo: this.repo }, product.id, auth.tiendaId)
      if (!result.ok) {
        this.toast.error(result.error.message)
        return
      }
      this.toast.success('Producto desactivado')
      this.store.patchProduct(product.id, { isActive: false })
    } catch (error) {
      this.toast.error(getErrorMessage(error, 'No se pudo desactivar'))
    }
  }
}
