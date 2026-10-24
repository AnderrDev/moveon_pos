import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core'
import { getErrorMessage } from '@/shared/lib/error-message'
import { RouterLink, RouterLinkActive } from '@angular/router'
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
  isMissingStock,
  type ProductStock,
} from '@angular-app/features/products/presentation/services/product-stock'
import { ExcelExportService } from '@angular-app/shared/services/export/excel-export.service'
import { buildProductsWorkbook } from '@angular-app/features/products/presentation/services/product-export'
import { MoneyPipe } from '@angular-app/shared/pipes/money.pipe'
import { SkeletonComponent } from '@angular-app/shared/atoms/skeleton.component'

@Component({
  selector: 'mo-productos-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SkeletonComponent, MoneyPipe, 
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
    <section class="flex h-full min-h-0 flex-col">
      <mo-page-header title="Productos" subtitle="Catálogo, precios y stock">
        <mo-button
          variant="outline"
          [loading]="exporting()"
          loadingText="Generando..."
          [disabled]="filteredProducts().length === 0"
          (click)="exportProducts()"
        >
          Descargar Excel
        </mo-button>
        <mo-button (click)="openCreate()">Nuevo producto</mo-button>
      </mo-page-header>

      <nav class="-mt-1 mb-4 flex gap-6 border-b text-sm" aria-label="Secciones de productos">
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

      <div class="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <input
          type="search"
          [value]="query()"
          (input)="onQueryInput($event)"
          placeholder="Buscar por nombre, SKU o código de barras"
          class="border-input bg-card focus:ring-ring h-10 min-w-56 flex-1 rounded-lg border px-3 text-sm focus:ring-2 focus:outline-none"
        />
        <select
          [value]="filterCategoria()"
          (change)="filterCategoria.set(getSelectValue($event))"
          class="border-input bg-card focus:ring-ring h-10 rounded-lg border px-3 text-sm focus:ring-2 focus:outline-none"
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
          class="border-input bg-card focus:ring-ring h-10 rounded-lg border px-3 text-sm focus:ring-2 focus:outline-none"
          aria-label="Filtrar por proveedor"
        >
          <option value="all">Todos los proveedores</option>
          @for (prov of proveedores(); track prov.id) {
            <option [value]="prov.id">{{ prov.nombre }}</option>
          }
          <option value="__sin__">Sin proveedor</option>
        </select>
        <select
          [value]="filterEstado()"
          (change)="onEstadoChange($event)"
          class="border-input bg-card focus:ring-ring h-10 rounded-lg border px-3 text-sm focus:ring-2 focus:outline-none"
          aria-label="Filtrar por estado"
        >
          <option value="active">Solo activos</option>
          <option value="inactive">Solo inactivos</option>
          <option value="all">Todos</option>
        </select>
        <label
          class="border-input bg-card flex h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm select-none"
        >
          <input
            type="checkbox"
            [checked]="soloFaltantes()"
            (change)="soloFaltantes.set(!soloFaltantes())"
            class="accent-primary h-4 w-4"
          />
          Solo faltantes
        </label>
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
            title="Sin productos"
            description="Crea tu primer producto para empezar a vender."
          >
            <mo-button (click)="openCreate()">Nuevo producto</mo-button>
          </mo-empty-state>
        } @else {
          <mo-empty-state
            title="Ningún producto coincide"
            description="Cambia la búsqueda o los filtros."
          />
        }
      } @else {
        <mo-table-shell class="flex-1">
          <table moTable>
            <thead moThead>
              <tr>
                <th moTh>Producto</th>
                <th moTh>Tipo</th>
                <th moTh class="text-right">Costo</th>
                <th moTh class="text-right">Precio</th>
                <th moTh class="text-right">Pto. venta</th>
                <th moTh class="text-right">Bodega</th>
                <th moTh class="text-right">Mín.</th>
                <th moTh></th>
                <th moTh></th>
              </tr>
            </thead>
            <tbody class="divide-y">
              @for (product of filteredProducts(); track product.id) {
                @let stock = stockOf(product);
                <tr
                  class="hover:bg-muted/30"
                  [class.bg-red-50]="stock.isOut"
                  [class.bg-amber-50]="stock.isLow && !stock.isOut"
                >
                  <td moTd>
                    <div class="font-semibold">{{ product.nombre }}</div>
                    <div class="text-muted-foreground text-xs">
                      {{ productMeta(product) }}
                    </div>
                  </td>
                  <td moTd class="text-muted-foreground text-xs">
                    {{ tipoLabel(product.tipo) }}
                  </td>
                  <td moTd class="text-muted-foreground text-right tabular-nums">
                    {{ product.costo !== null ? (product.costo | money) : '—' }}
                  </td>
                  <td moTd class="text-right font-semibold tabular-nums">
                    {{ (product.precioVenta | money) }}
                  </td>
                  @if (stock.tracksStock) {
                    <td
                      moTd
                      class="text-right font-bold tabular-nums"
                      [class.text-destructive]="stock.isOut"
                    >
                      {{ stock.puntoVentaStock }}
                    </td>
                    <td moTd class="text-right font-semibold tabular-nums">
                      {{ stock.bodegaStock }}
                    </td>
                    <td moTd class="text-muted-foreground text-right tabular-nums">
                      {{ product.stockMinimo }}
                    </td>
                  } @else {
                    <td moTd colspan="3" class="text-muted-foreground text-right text-xs">
                      Sin stock propio
                    </td>
                  }
                  <td moTd>
                    <div class="flex flex-wrap gap-1">
                      @if (stock.isOut) {
                        <mo-badge variant="destructive">Agotado</mo-badge>
                      } @else if (stock.isLow) {
                        <mo-badge variant="warning">Stock bajo</mo-badge>
                      }
                      @if (!product.isActive) {
                        <mo-badge variant="warning">Inactivo</mo-badge>
                      }
                    </div>
                  </td>
                  <td moTd class="text-right">
                    <div class="flex items-center justify-end gap-1.5">
                      @if (canMoveStock(product)) {
                        <mo-button size="sm" variant="outline" (click)="openEntry(product)">
                          + Entrada
                        </mo-button>
                      }
                      <mo-button size="sm" variant="outline" (click)="openEdit(product)">
                        Editar
                      </mo-button>
                      <mo-menu size="sm" [label]="'Más acciones para ' + product.nombre">
                        @if (canMoveStock(product)) {
                          <button type="button" moMenuItem (click)="openAdjust(product)">
                            Ajustar stock
                          </button>
                          <button type="button" moMenuItem (click)="openTransfer(product)">
                            Trasladar
                          </button>
                        }
                        @if (stock.tracksStock) {
                          <button type="button" moMenuItem (click)="openKardex(product)">
                            Kardex
                          </button>
                        }
                        @if (product.isActive) {
                          <button type="button" moMenuItem (click)="confirmDeactivate(product)">
                            Desactivar
                          </button>
                        }
                        <button type="button" moMenuItem class="text-destructive" (click)="openDeleteConfirm(product)">
                          Eliminar
                        </button>
                      </mo-menu>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </mo-table-shell>
      }
    </section>

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

  readonly soloFaltantes = signal(false)

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
  readonly filterEstado = signal<'all' | 'active' | 'inactive'>('active')
  readonly deleteConfirmOpen = signal(false)
  readonly deletingProduct = signal<Product | null>(null)
  readonly deleteConfirmInput = signal('')
  readonly deleting = signal(false)

  readonly filteredProducts = computed(() => {
    const q = this.query().trim().toLowerCase()
    const cat = this.filterCategoria()
    const prov = this.filterProveedor()
    const estado = this.filterEstado()
    const soloFaltantes = this.soloFaltantes()
    const stockById = this.stockById()
    return this.products().filter((p) => {
      if (q && !([p.nombre, p.sku ?? '', p.codigoBarras ?? ''].join(' ').toLowerCase().includes(q))) return false
      if (cat !== 'all' && p.categoriaId !== cat) return false
      if (prov === '__sin__' && p.proveedorId) return false
      if (prov !== 'all' && prov !== '__sin__' && p.proveedorId !== prov) return false
      if (estado === 'active' && !p.isActive) return false
      if (estado === 'inactive' && p.isActive) return false
      if (soloFaltantes) {
        const stock = stockById.get(p.id)
        if (!stock || !isMissingStock(stock)) return false
      }
      return true
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

  categoriaName(id: string | null): string | null {
    if (!id) return null
    return this.categorias().find((c) => c.id === id)?.nombre ?? null
  }

  /** Línea secundaria: categoría · SKU · proveedor, lo que exista. */
  productMeta(product: Product): string {
    return [this.categoriaName(product.categoriaId), product.sku, product.proveedorNombre]
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

  onEstadoChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value
    if (val === 'active' || val === 'inactive' || val === 'all') {
      this.filterEstado.set(val)
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
