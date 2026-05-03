import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core'
import { RouterLink, RouterLinkActive } from '@angular/router'
import { PageHeaderComponent } from '../../shared/layout/page-header.component'
import { ButtonComponent } from '../../shared/ui/button.component'
import { BadgeComponent } from '../../shared/ui/badge.component'
import { EmptyStateComponent } from '../../shared/feedback/empty-state.component'
import { ProductFormDialog } from './product-form.dialog'
import { ProductsRepository } from './products.repository'
import { SessionService } from '../../core/auth/session.service'
import { ToastService } from '../../shared/feedback/toast.service'
import { formatCurrency } from '@/shared/lib/format'
import type { Categoria, Product } from '@/modules/products/domain/entities/product.entity'

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
  ],
  template: `
    <section class="flex h-full min-h-0 flex-col">
      <mo-page-header title="Productos" subtitle="Catalogo y precios">
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
          class="border-input bg-card focus:ring-ring h-10 flex-1 rounded-lg border px-3 text-sm focus:outline-none focus:ring-2"
        />
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
            <thead class="bg-muted/50 text-muted-foreground sticky top-0 text-left text-xs uppercase tracking-wide">
              <tr>
                <th class="px-4 py-3">Producto</th>
                <th class="px-4 py-3">SKU</th>
                <th class="px-4 py-3 text-right">Precio</th>
                <th class="px-4 py-3 text-right">IVA</th>
                <th class="px-4 py-3 text-right">Stock min.</th>
                <th class="px-4 py-3"></th>
                <th class="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody class="divide-y">
              @for (product of filteredProducts(); track product.id) {
                <tr class="hover:bg-muted/30">
                  <td class="px-4 py-3">
                    <div class="font-semibold">{{ product.nombre }}</div>
                    @if (categoriaName(product.categoriaId)) {
                      <div class="text-muted-foreground text-xs">
                        {{ categoriaName(product.categoriaId) }}
                      </div>
                    }
                  </td>
                  <td class="text-muted-foreground px-4 py-3 font-mono text-xs">
                    {{ product.sku ?? '—' }}
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
                  <td class="px-4 py-3">
                    @if (!product.isActive) {
                      <mo-badge variant="warning">Inactivo</mo-badge>
                    }
                  </td>
                  <td class="px-4 py-3 text-right">
                    <div class="flex justify-end gap-1">
                      <mo-button size="sm" variant="outline" (click)="openEdit(product)">
                        Editar
                      </mo-button>
                      @if (product.isActive) {
                        <mo-button
                          size="sm"
                          variant="ghost"
                          (click)="confirmDeactivate(product)"
                        >
                          Desactivar
                        </mo-button>
                      }
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
  `,
})
export class ProductosPage {
  private readonly repo = inject(ProductsRepository)
  private readonly session = inject(SessionService)
  private readonly toast = inject(ToastService)

  readonly products = signal<Product[]>([])
  readonly categorias = signal<Categoria[]>([])
  readonly loading = signal(true)
  readonly loadError = signal<string | null>(null)
  readonly query = signal('')
  readonly dialogOpen = signal(false)
  readonly editingProduct = signal<Product | null>(null)

  readonly filteredProducts = computed(() => {
    const q = this.query().trim().toLowerCase()
    if (!q) return this.products()
    return this.products().filter((p) =>
      [p.nombre, p.sku ?? '', p.codigoBarras ?? '']
        .join(' ')
        .toLowerCase()
        .includes(q),
    )
  })

  constructor() {
    void this.load()
  }

  money(amount: number): string {
    return formatCurrency(amount)
  }

  categoriaName(id: string | null): string | null {
    if (!id) return null
    return this.categorias().find((c) => c.id === id)?.nombre ?? null
  }

  onQueryInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value)
  }

  async load(): Promise<void> {
    this.loading.set(true)
    this.loadError.set(null)
    try {
      const auth = await this.session.getAuthContext()
      if (!auth) throw new Error('No autenticado')
      const [products, categorias] = await Promise.all([
        this.repo.listProducts({ tiendaId: auth.tiendaId, soloActivos: false }),
        this.repo.listCategorias(auth.tiendaId),
      ])
      this.products.set(products)
      this.categorias.set(categorias)
    } catch (error) {
      this.loadError.set(error instanceof Error ? error.message : 'Error al cargar productos')
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
    const current = this.products()
    const idx = current.findIndex((p) => p.id === product.id)
    if (idx >= 0) {
      const next = [...current]
      next[idx] = product
      this.products.set(next)
    } else {
      this.products.set([product, ...current])
    }
  }

  async confirmDeactivate(product: Product): Promise<void> {
    if (!window.confirm(`¿Desactivar "${product.nombre}"?`)) return
    const auth = await this.session.getAuthContext()
    if (!auth) return
    try {
      await this.repo.deactivateProduct(product.id, auth.tiendaId)
      this.toast.success('Producto desactivado')
      this.products.set(
        this.products().map((p) => (p.id === product.id ? { ...p, isActive: false } : p)),
      )
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'No se pudo desactivar')
    }
  }
}
