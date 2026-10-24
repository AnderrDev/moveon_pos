import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core'
import {
  filterCatalog,
  isOutOfStock,
  productStockLabel,
} from '@angular-app/features/pos/presentation/services/pos-catalog'
import type { PosCategory, PosProduct } from '@angular-app/features/pos/presentation/services/pos.types'
import { MoneyPipe } from '@angular-app/shared/pipes/money.pipe'
import { ChevronRight, Info, Layers, Plus, LucideAngularModule } from 'lucide-angular'

/**
 * Catálogo del POS: búsqueda (nombre, SKU o código de barras), chips de
 * categoría y grilla de productos. Escanear un código de barras completo
 * agrega el producto. Presentacional: emite `add` / `info` y la página decide.
 */
@Component({
  selector: 'mo-pos-catalog',
  standalone: true,
  imports: [LucideAngularModule, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-h-0 flex-1 flex-col overflow-hidden' },
  template: `
    <div class="flex shrink-0 items-center justify-between border-b px-4 py-3 lg:px-6">
      <p class="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
        {{ products().length }} productos
      </p>
      @if (cartItemCount() > 0) {
        <p class="text-muted-foreground text-xs">
          {{ cartItemCount() }} items en carrito
        </p>
      }
    </div>

    <div class="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-3 sm:p-4 lg:p-5">
      <div class="relative shrink-0">
        <input
          type="search"
          [value]="query()"
          (input)="setQuery($event)"
          placeholder="Buscar por nombre, SKU o codigo de barras..."
          class="border-input bg-background focus:ring-ring h-11 w-full rounded-xl border px-4 text-sm transition-shadow outline-none focus:ring-2"
        />
      </div>

      @if (categories().length > 0) {
        <div class="flex shrink-0 gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          <button
            type="button"
            (click)="activeCategory.set(null)"
            [class]="categoryClass(null)"
          >
            Todos
          </button>
          @for (category of categories(); track category.id) {
            <button
              type="button"
              (click)="toggleCategory(category.id)"
              [class]="categoryClass(category.id)"
            >
              {{ category.nombre }}
            </button>
          }
        </div>
      }

      <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        @if (filteredProducts().length === 0) {
          <div class="text-muted-foreground flex h-48 items-center justify-center text-sm">
            Sin productos para esta busqueda
          </div>
        } @else {
          <div class="grid grid-cols-1 gap-2.5 pb-3 sm:grid-cols-2 2xl:grid-cols-3">
            @for (product of filteredProducts(); track product.id) {
              <article [class]="productCardClass(product)">
                <button
                  type="button"
                  [disabled]="isOutOfStock(product)"
                  [attr.aria-label]="'Agregar ' + product.nombre + ' al carrito'"
                  (click)="add.emit(product)"
                  [class]="productAddButtonClass(product)"
                >
                  <div class="flex w-full items-center justify-between gap-2">
                    <span
                      class="text-muted-foreground min-w-0 truncate font-mono text-[10px] font-semibold tracking-wide uppercase"
                    >
                      {{ product.sku || 'Producto' }}
                    </span>
                    <span [class]="productStockBadgeClass(product)">
                      <span class="h-1.5 w-1.5 rounded-full bg-current opacity-70"></span>
                      {{ stockLabel(product) }}
                    </span>
                  </div>

                  <h3
                    class="text-foreground mt-3 w-full text-[15px] leading-[1.3] font-bold tracking-[-0.01em]"
                  >
                    {{ product.nombre }}
                  </h3>

                  <div class="mt-auto flex w-full items-end justify-between gap-3 pt-5">
                    <div class="min-w-0">
                      <span
                        class="text-muted-foreground block text-[10px] font-semibold tracking-wide uppercase"
                      >
                        Precio de venta
                      </span>
                      <span
                        class="font-display text-primary mt-0.5 block text-lg leading-none font-bold tabular-nums"
                      >
                        {{ (product.precioVenta | money) }}
                      </span>
                      @if (product.components.length > 0) {
                        <span class="text-amber-600 mt-1.5 flex items-center gap-1 text-[10px] font-semibold">
                          <lucide-angular [img]="icons.layers" class="h-3 w-3 shrink-0" aria-hidden="true" />
                          Descuenta: {{ componentLabel(product.components) }}
                        </span>
                      }
                    </div>

                    @if (isOutOfStock(product)) {
                      <span
                        class="bg-destructive/10 text-destructive inline-flex h-10 shrink-0 items-center rounded-xl px-3 text-[11px] font-bold"
                      >
                        Agotado
                      </span>
                    } @else {
                      <span
                        aria-hidden="true"
                        class="bg-primary text-primary-foreground shadow-primary/20 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-md transition-transform group-active:scale-90"
                      >
                        <lucide-angular [img]="icons.plus" class="h-5 w-5" [strokeWidth]="2.5" aria-hidden="true" />
                      </span>
                    }
                  </div>
                </button>
                <div class="border-border/60 bg-muted/20 w-full border-t px-2 py-1.5">
                  <button
                    type="button"
                    [attr.aria-label]="'Ver información de ' + product.nombre"
                    (click)="info.emit(product)"
                    class="text-muted-foreground hover:bg-background hover:text-foreground focus:ring-ring flex min-h-11 w-full items-center justify-between rounded-lg px-2.5 text-xs font-semibold transition-colors focus:ring-2 focus:outline-none"
                  >
                    <span class="flex items-center gap-2">
                      <lucide-angular [img]="icons.info" class="h-4 w-4" aria-hidden="true" />
                      Ficha del producto
                    </span>
                    <lucide-angular [img]="icons.chevronRight" class="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </article>
            }
          </div>
        }
      </div>
    </div>
  `,
})
export class PosCatalogComponent {
  readonly icons = { chevronRight: ChevronRight, info: Info, layers: Layers, plus: Plus }

  readonly products = input.required<PosProduct[]>()
  readonly categories = input.required<PosCategory[]>()
  readonly cartItemCount = input(0)

  readonly add = output<PosProduct>()
  readonly info = output<PosProduct>()

  readonly query = signal('')
  readonly activeCategory = signal<string | null>(null)

  readonly filteredProducts = computed(() =>
    filterCatalog(this.products(), this.query(), this.activeCategory()),
  )

  readonly isOutOfStock = isOutOfStock


  componentLabel(components: { nombre: string; cantidad: number }[]): string {
    return components
      .map((c) => (c.cantidad === 1 ? `1 ${c.nombre}` : `${c.cantidad}× ${c.nombre}`))
      .join(', ')
  }

  setQuery(event: Event): void {
    const value = (event.target as HTMLInputElement).value
    this.query.set(value)

    const trimmed = value.trim()
    if (trimmed.length < 6) return

    const barcodeMatch = this.products().find((product) => product.codigoBarras === trimmed)
    if (!barcodeMatch) return

    this.add.emit(barcodeMatch)
    this.query.set('')
  }

  toggleCategory(categoryId: string): void {
    this.activeCategory.set(this.activeCategory() === categoryId ? null : categoryId)
  }

  categoryClass(categoryId: string | null): string {
    const active = this.activeCategory() === categoryId
    return [
      'min-h-9 shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-150',
      active
        ? 'bg-primary text-primary-foreground shadow-sm'
        : 'bg-muted text-muted-foreground hover:bg-muted/70',
    ].join(' ')
  }

  productCardClass(product: PosProduct): string {
    const outOfStock = isOutOfStock(product)
    return [
      'group bg-card relative flex min-h-52 flex-col overflow-hidden rounded-2xl border text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-200',
      outOfStock
        ? 'border-border opacity-80'
        : 'hover:border-primary/40 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-16px_rgba(15,23,42,0.35)]',
    ].join(' ')
  }

  productAddButtonClass(product: PosProduct): string {
    return [
      'focus:ring-ring relative flex w-full flex-1 flex-col items-start p-4 text-left transition-colors focus:ring-2 focus:outline-none',
      isOutOfStock(product)
        ? 'cursor-not-allowed'
        : 'cursor-pointer hover:bg-primary/[0.035] active:bg-primary/[0.07]',
    ].join(' ')
  }

  stockLabel(product: PosProduct): string {
    return productStockLabel(product.stockDisponible)
  }

  productStockBadgeClass(product: PosProduct): string {
    const base =
      'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold leading-4 tabular-nums'
    if (product.stockDisponible === null) {
      return `${base} border-border bg-muted text-muted-foreground`
    }
    if (isOutOfStock(product)) {
      return `${base} border-destructive/30 bg-destructive/10 text-destructive`
    }
    return `${base} border-emerald-600/25 bg-emerald-500/10 text-emerald-700`
  }
}
