import { computed, effect, inject, Injectable, signal } from '@angular/core'
import { SessionService } from '../../core/auth/session.service'
import { ProductsRepository } from './products.repository'
import { TtlCache } from '@/shared/cache/ttl-cache'
import type { Categoria, Product } from '@/modules/products/domain/entities/product.entity'

const DEFAULT_TTL_MS = 5 * 60 * 1000

interface EnsureOptions {
  force?: boolean
  ttlMs?: number
}

@Injectable({ providedIn: 'root' })
export class ProductsCacheStore {
  private readonly repo = inject(ProductsRepository)
  private readonly session = inject(SessionService)

  private readonly _products = signal<Product[] | null>(null)
  private readonly _categorias = signal<Categoria[] | null>(null)

  private readonly productsCache = new TtlCache<Product[]>({ ttlMs: DEFAULT_TTL_MS })
  private readonly categoriasCache = new TtlCache<Categoria[]>({ ttlMs: DEFAULT_TTL_MS })

  private lastUserId: string | null = null

  readonly products = this._products.asReadonly()
  readonly categorias = this._categorias.asReadonly()

  readonly activeProducts = computed(() => (this._products() ?? []).filter((p) => p.isActive))
  readonly activeCategorias = computed(() => (this._categorias() ?? []).filter((c) => c.isActive))

  constructor() {
    effect(() => {
      const userId = this.session.user()?.id ?? null
      if (this.lastUserId !== null && this.lastUserId !== userId) {
        this.invalidate()
      }
      this.lastUserId = userId
    })
  }

  async ensureProducts(tiendaId: string, options: EnsureOptions = {}): Promise<Product[]> {
    const data = await this.productsCache.ensure(
      tiendaId,
      () => this.repo.listProducts({ tiendaId, soloActivos: false }),
      options,
    )
    this._products.set(data)
    return data
  }

  async ensureCategorias(tiendaId: string, options: EnsureOptions = {}): Promise<Categoria[]> {
    const data = await this.categoriasCache.ensure(
      tiendaId,
      () => this.repo.listCategorias(tiendaId),
      options,
    )
    this._categorias.set(data)
    return data
  }

  upsertProduct(product: Product): void {
    this._products.set(upsertById(this._products() ?? [], product, 'prepend'))
    this.productsCache.set(product.tiendaId, this._products() as Product[])
  }

  removeProduct(id: string): void {
    const list = this._products()
    if (!list) return
    const next = list.filter((p) => p.id !== id)
    this._products.set(next)
    if (next[0]) this.productsCache.set(next[0].tiendaId, next)
  }

  patchProduct(id: string, patch: Partial<Product>): void {
    const list = this._products()
    if (!list) return
    const next = list.map((p) => (p.id === id ? { ...p, ...patch } : p))
    this._products.set(next)
    if (next[0]) this.productsCache.set(next[0].tiendaId, next)
  }

  upsertCategoria(categoria: Categoria): void {
    this._categorias.set(upsertById(this._categorias() ?? [], categoria, 'append'))
    this.categoriasCache.set(categoria.tiendaId, this._categorias() as Categoria[])
  }

  patchCategoria(id: string, patch: Partial<Categoria>): void {
    const list = this._categorias()
    if (!list) return
    const next = list.map((c) => (c.id === id ? { ...c, ...patch } : c))
    this._categorias.set(next)
    if (next[0]) this.categoriasCache.set(next[0].tiendaId, next)
  }

  invalidate(): void {
    this._products.set(null)
    this._categorias.set(null)
    this.productsCache.invalidate()
    this.categoriasCache.invalidate()
  }
}

function upsertById<T extends { id: string }>(
  list: T[],
  item: T,
  position: 'prepend' | 'append',
): T[] {
  const idx = list.findIndex((x) => x.id === item.id)
  if (idx >= 0) {
    const next = [...list]
    next[idx] = item
    return next
  }
  return position === 'prepend' ? [item, ...list] : [...list, item]
}
