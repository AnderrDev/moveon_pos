import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core'
import { getErrorMessage } from '@/shared/lib/error-message'
import { RouterLink, RouterLinkActive } from '@angular/router'
import { PageHeaderComponent } from '../../shared/layout/page-header.component'
import { ButtonComponent } from '../../shared/ui/button.component'
import { BadgeComponent } from '../../shared/ui/badge.component'
import { EmptyStateComponent } from '../../shared/feedback/empty-state.component'
import { ProductFormDialog } from './product-form.dialog'
import { DialogComponent } from '../../shared/ui/dialog.component'
import { ProductsRepository } from './products.repository'
import { ProductsCacheStore } from './products-cache.store'
import { InventoryRepository } from '../inventory/inventory.repository'
import { SessionService } from '../../core/auth/session.service'
import { ToastService } from '../../shared/feedback/toast.service'
import { formatCurrency } from '@/shared/lib/format'
import type { Product } from '@/modules/products/domain/entities/product.entity'
import type { StockLevel } from '@/modules/inventory/domain/entities/inventory.entity'
import { isOutOfStock } from '@/modules/inventory/domain/services/low-stock'
import { ExcelExportService } from '../../shared/export/excel-export.service'
import { buildProductsWorkbook } from './product-export'

@Component({
  selector: 'mo-productos-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    RouterLinkActive,
    PageHeaderComponent,
    ButtonComponent,
    BadgeComponent,
    EmptyStateComponent,
    ProductFormDialog,
    DialogComponent,
  ],
  template: `
    <section class="flex h-full min-h-0 flex-col">
      <mo-page-header title="Productos" subtitle="Catalogo y precios">
        <mo-button
          variant="outline"
          [loading]="exporting()"
          loadingText="Generando..."
          [disabled]="filteredProducts().length === 0"
          (click)="exportProducts()"
        >
          Descargar Excel
        </mo-button>
        <mo-button (click)="openCreate()">+ Nuevo producto</mo-button>
      </mo-page-header>

      <nav class="mb-4 flex gap-1 text-sm">
        <a
          routerLink="/productos"
          routerLinkActive="bg-primary text-primary-foreground"
          [routerLinkActiveOptions]="{ exact: true }"
          class="hover:bg-muted rounded-lg px-3 py-1.5 font-semibold"
          >Productos</a
        >
        <a
          routerLink="/productos/categorias"
          routerLinkActive="bg-primary text-primary-foreground"
          class="hover:bg-muted rounded-lg px-3 py-1.5 font-semibold"
          >Categorias</a
        >
      </nav>

      <div class="mb-4 flex flex-col gap-2 sm:flex-row">
        <input
          type="search"
          [value]="query()"
          (input)="onQueryInput($event)"
          placeholder="Buscar por nombre, SKU o codigo de barras"
          class="border-input bg-card focus:ring-ring h-10 flex-1 rounded-lg border px-3 text-sm focus:ring-2 focus:outline-none"
        />
        <select
          [value]="filterCategoria()"
          (change)="filterCategoria.set(getSelectValue($event))"
          class="border-input bg-card focus:ring-ring h-10 rounded-lg border px-3 text-sm focus:ring-2 focus:outline-none"
        >
          <option value="all">Todas las categorias</option>
          @for (cat of categorias(); track cat.id) {
            <option [value]="cat.id">{{ cat.nombre }}</option>
          }
        </select>
        <select
          [value]="filterEstado()"
          (change)="onEstadoChange($event)"
          class="border-input bg-card focus:ring-ring h-10 rounded-lg border px-3 text-sm focus:ring-2 focus:outline-none"
        >
          <option value="active">Solo activos</option>
          <option value="inactive">Solo inactivos</option>
          <option value="all">Todos</option>
        </select>
      </div>

      @if (loading()) {
        <div class="bg-card flex-1 animate-pulse rounded-xl border p-8">
          <div class="bg-muted mb-3 h-6 w-40 rounded"></div>
          <div class="bg-muted/50 h-72 rounded-xl"></div>
        </div>
      } @else if (loadError()) {
        <mo-empty-state title="No se pudo cargar el catalogo" [description]="loadError()">
          <mo-button (click)="load()">Reintentar</mo-button>
        </mo-empty-state>
      } @else if (filteredProducts().length === 0) {
        <mo-empty-state
          title="Sin productos"
          description="Crea tu primer producto para empezar a vender."
        >
          <mo-button (click)="openCreate()">+ Nuevo producto</mo-button>
        </mo-empty-state>
      } @else {
        <div class="bg-card flex-1 overflow-auto rounded-xl border">
          <table class="w-full text-sm">
            <thead
              class="bg-muted/50 text-muted-foreground sticky top-0 text-left text-xs tracking-wide uppercase"
            >
              <tr>
                <th class="px-4 py-3">Producto</th>
                <th class="px-4 py-3">Tipo</th>
                <th class="px-4 py-3">SKU</th>
                <th class="px-4 py-3 text-right">Costo</th>
                <th class="px-4 py-3 text-right">Precio</th>
                <th class="px-4 py-3 text-right">IVA</th>
                <th class="px-4 py-3 text-right">Stock min.</th>
                <th class="px-4 py-3 text-right">Pto. venta</th>
                <th class="px-4 py-3 text-right">Bodega</th>
                <th class="px-4 py-3"></th>
                <th class="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody class="divide-y">
              @for (product of filteredProducts(); track product.id) {
                <tr class="hover:bg-muted/30" [class.bg-red-50]="isOut(product)">
                  <td class="px-4 py-3">
                    <div class="font-semibold">{{ product.nombre }}</div>
                    @if (categoriaName(product.categoriaId)) {
                      <div class="text-muted-foreground text-xs">
                        {{ categoriaName(product.categoriaId) }}
                      </div>
                    }
                  </td>
                  <td class="text-muted-foreground px-4 py-3 text-xs">
                    {{ tipoLabel(product.tipo) }}
                  </td>
                  <td class="text-muted-foreground px-4 py-3 font-mono text-xs">
                    {{ product.sku ?? '—' }}
                  </td>
                  <td class="text-muted-foreground px-4 py-3 text-right tabular-nums">
                    {{ product.costo !== null ? money(product.costo) : '—' }}
                  </td>
                  <td class="px-4 py-3 text-right font-semibold tabular-nums">
                    {{ money(product.precioVenta) }}
                  </td>
                  <td class="text-muted-foreground px-4 py-3 text-right tabular-nums">
                    {{ product.ivaTasa }}%
                  </td>
                  <td class="text-muted-foreground px-4 py-3 text-right tabular-nums">
                    {{ product.stockMinimo }}
                  </td>
                  <td
                    class="px-4 py-3 text-right tabular-nums font-semibold"
                    [class.text-destructive]="isOut(product)"
                  >
                    {{ stockMap().get(product.id)?.puntoVentaStock ?? '—' }}
                  </td>
                  <td class="text-muted-foreground px-4 py-3 text-right tabular-nums">
                    {{ stockMap().get(product.id)?.bodegaStock ?? '—' }}
                  </td>
                  <td class="px-4 py-3">
                    <div class="flex flex-wrap gap-1">
                      @if (isOut(product)) {
                        <mo-badge variant="destructive">Agotado</mo-badge>
                      }
                      @if (!product.isActive) {
                        <mo-badge variant="warning">Inactivo</mo-badge>
                      }
                    </div>
                  </td>
                  <td class="px-4 py-3 text-right">
                    <div class="flex justify-end gap-1">
                      <mo-button size="sm" variant="outline" (click)="openEdit(product)">
                        Editar
                      </mo-button>
                      @if (product.isActive) {
                        <mo-button size="sm" variant="ghost" (click)="confirmDeactivate(product)">
                          Desactivar
                        </mo-button>
                      }
                      <mo-button size="sm" variant="ghost" class="text-destructive hover:text-destructive" (click)="openDeleteConfirm(product)">
                        Eliminar
                      </mo-button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>

    <mo-product-form-dialog
      [open]="dialogOpen()"
      [product]="editingProduct()"
      [categorias]="categorias()"
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
  private readonly repo = inject(ProductsRepository)
  private readonly store = inject(ProductsCacheStore)
  private readonly inventoryRepo = inject(InventoryRepository)
  private readonly session = inject(SessionService)
  private readonly toast = inject(ToastService)
  private readonly excel = inject(ExcelExportService)

  readonly products = computed(() => this.store.products() ?? [])
  readonly categorias = computed(() => this.store.categorias() ?? [])
  readonly stockLevels = signal<StockLevel[]>([])
  readonly loading = signal(true)
  readonly loadError = signal<string | null>(null)
  readonly query = signal('')
  readonly dialogOpen = signal(false)
  readonly editingProduct = signal<Product | null>(null)
  readonly exporting = signal(false)

  readonly stockMap = computed(() => new Map(this.stockLevels().map((s) => [s.productId, s])))

  readonly filterCategoria = signal<string>('all')
  readonly filterEstado = signal<'all' | 'active' | 'inactive'>('active')
  readonly deleteConfirmOpen = signal(false)
  readonly deletingProduct = signal<Product | null>(null)
  readonly deleteConfirmInput = signal('')
  readonly deleting = signal(false)

  readonly filteredProducts = computed(() => {
    const q = this.query().trim().toLowerCase()
    const cat = this.filterCategoria()
    const estado = this.filterEstado()
    return this.products().filter((p) => {
      if (q && !([p.nombre, p.sku ?? '', p.codigoBarras ?? ''].join(' ').toLowerCase().includes(q))) return false
      if (cat !== 'all' && p.categoriaId !== cat) return false
      if (estado === 'active' && !p.isActive) return false
      if (estado === 'inactive' && p.isActive) return false
      return true
    })
  })

  constructor() {
    void this.load()
  }

  money(amount: number): string {
    return formatCurrency(amount)
  }

  tipoLabel(tipo: string): string {
    const labels: Record<string, string> = {
      simple: 'Simple',
      prepared: 'Preparado',
      ingredient: 'Ingrediente',
    }
    return labels[tipo] ?? tipo
  }

  isOut(product: Product): boolean {
    const puntoVentaStock = this.stockMap().get(product.id)?.puntoVentaStock ?? 0
    return isOutOfStock({ tipo: product.tipo, currentStock: puntoVentaStock })
  }

  categoriaName(id: string | null): string | null {
    if (!id) return null
    return this.categorias().find((c) => c.id === id)?.nombre ?? null
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
      await this.repo.deleteProduct(product.id, auth.tiendaId)
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
        buildProductsWorkbook(this.filteredProducts(), this.categorias(), this.query())
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
      const [, , stockLevels] = await Promise.all([
        this.store.ensureProducts(auth.tiendaId, { force: options.force }),
        this.store.ensureCategorias(auth.tiendaId, { force: options.force }),
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
      await this.repo.deactivateProduct(product.id, auth.tiendaId)
      this.toast.success('Producto desactivado')
      this.store.patchProduct(product.id, { isActive: false })
    } catch (error) {
      this.toast.error(getErrorMessage(error, 'No se pudo desactivar'))
    }
  }
}
