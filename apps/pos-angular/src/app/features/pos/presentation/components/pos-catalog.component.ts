import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core'
import {
  filterCatalog,
  isOutOfStock,
  productStockLabel,
} from '@angular-app/features/pos/presentation/services/pos-catalog'
import type { PosCategory, PosProduct } from '@angular-app/features/pos/presentation/services/pos.types'
import { MoneyPipe } from '@angular-app/shared/pipes/money.pipe'
import { Info, Layers, Plus, Search, LucideAngularModule } from 'lucide-angular'

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
    <div class="flex shrink-0 flex-col gap-3 pb-3">
      <label class="relative block">
        <span class="sr-only">Buscar producto</span>
        <span class="text-muted-foreground pointer-events-none absolute inset-y-0 left-4 flex items-center" aria-hidden="true">
          <lucide-angular [img]="icons.search" class="h-5 w-5" />
        </span>
        <input
          type="search"
          [value]="query()"
          (input)="setQuery($event)"
          placeholder="Buscar o escanear código de barras"
          class="border-input bg-card focus:border-foreground h-12 w-full rounded-xl border pr-4 pl-12 text-[15px] transition-colors outline-none"
        />
      </label>

      @if (categories().length > 0) {
        <div class="flex shrink-0 gap-2 overflow-x-auto [scrollbar-width:none]" role="group" aria-label="Categorías">
          <button
            type="button"
            (click)="activeCategory.set(null)"
            [class]="categoryClass(null)"
            [attr.aria-pressed]="activeCategory() === null"
          >
            Todos
            <span class="tabular-nums opacity-60">{{ products().length }}</span>
          </button>
          @for (category of categories(); track category.id) {
            <button
              type="button"
              (click)="toggleCategory(category.id)"
              [class]="categoryClass(category.id)"
              [attr.aria-pressed]="activeCategory() === category.id"
            >
              {{ category.nombre }}
            </button>
          }
        </div>
      }
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      @if (filteredProducts().length === 0) {
        <div class="text-muted-foreground flex h-48 flex-col items-center justify-center gap-1 text-center text-sm">
          <p class="text-foreground font-semibold">Ningún producto coincide</p>
          <p>Prueba con otro nombre, SKU o categoría.</p>
        </div>
      } @else {
        <div class="grid grid-cols-2 gap-2 pb-3 sm:gap-2.5 xl:grid-cols-3">
          @for (product of filteredProducts(); track product.id) {
            <article [class]="productCardClass(product)">
              <button
                type="button"
                [disabled]="isOutOfStock(product)"
                [attr.aria-label]="'Agregar ' + product.nombre + ' al carrito'"
                (click)="add.emit(product)"
                class="focus-visible:ring-foreground flex w-full flex-1 flex-col items-start rounded-2xl p-3 text-left sm:p-4 focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed"
              >
                <span [class]="productStockBadgeClass(product)">
                  {{ stockLabel(product) }}
                </span>

                <h3 class="font-display mt-2 w-full pr-6 text-sm sm:mt-2.5 sm:pr-8 sm:text-[15px] leading-snug font-bold">
                  {{ product.nombre }}
                </h3>
                @if (product.sku) {
                  <span class="text-muted-foreground mt-0.5 text-xs">{{ product.sku }}</span>
                }
                @if (product.components.length > 0) {
                  <span class="text-muted-foreground mt-1.5 flex items-start gap-1 text-[11px] leading-snug">
                    <lucide-angular [img]="icons.layers" class="mt-px h-3 w-3 shrink-0" aria-hidden="true" />
                    Incluye {{ componentLabel(product.components) }}
                  </span>
                }

                <div class="mt-auto flex w-full items-end justify-between gap-3 pt-4">
                  <span class="font-display text-base leading-none font-extrabold tabular-nums sm:text-xl">
                    {{ (product.precioVenta | money) }}
                  </span>
                  @if (isOutOfStock(product)) {
                    <span class="text-destructive text-xs font-bold">Agotado</span>
                  } @else {
                    <span
                      aria-hidden="true"
                      class="bg-primary text-primary-foreground inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform sm:h-11 sm:w-11 group-active:scale-90"
                    >
                      <lucide-angular [img]="icons.plus" class="h-5 w-5" [strokeWidth]="2.75" aria-hidden="true" />
                    </span>
                  }
                </div>
              </button>

              <button
                type="button"
                [attr.aria-label]="'Ver ficha de ' + product.nombre"
                title="Ficha del producto"
                (click)="info.emit(product)"
                class="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-foreground absolute top-1 right-1 flex h-10 w-10 sm:top-2 sm:right-2 items-center justify-center rounded-lg transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                <lucide-angular [img]="icons.info" class="h-[18px] w-[18px]" aria-hidden="true" />
              </button>
            </article>
          }
        </div>
      }
    </div>
  `,
})
export class PosCatalogComponent {
  readonly icons = { info: Info, layers: Layers, plus: Plus, search: Search }

  readonly products = input.required<PosProduct[]>()
  readonly categories = input.required<PosCategory[]>()

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
      'inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition-colors',
      active
        ? 'border-foreground bg-foreground text-background'
        : 'bg-card text-foreground hover:border-foreground/40',
    ].join(' ')
  }

  productCardClass(product: PosProduct): string {
    return [
      'group bg-card relative flex min-h-40 flex-col sm:min-h-44 rounded-2xl border transition-colors',
      isOutOfStock(product) ? 'opacity-60' : 'hover:border-foreground/40',
    ].join(' ')
  }

  stockLabel(product: PosProduct): string {
    return productStockLabel(product.stockDisponible)
  }

  productStockBadgeClass(product: PosProduct): string {
    const base = 'inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums'
    if (product.stockDisponible === null) return `${base} bg-muted text-muted-foreground`
    if (isOutOfStock(product)) return `${base} bg-destructive/10 text-destructive`
    return `${base} bg-emerald-500/10 text-emerald-700`
  }

}
