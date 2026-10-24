/**
 * Lógica de catálogo: visibilidad de categorías, búsqueda, ofertas y
 * paginación. Funciones puras (TS, sin Angular) para poder testearlas sin
 * levantar el componente.
 */

import type { CatalogoCategoria, CatalogoProducto } from './catalogo.service'

/** Categorías que no se muestran en el catálogo público. */
export const HIDDEN_CATEGORIES: readonly string[] = ['Ingredientes para batidos']

export const PRODUCTS_PAGE_SIZE = 10

/**
 * Orden de prioridad en la cinta de ofertas del header; cualquier otra
 * etiqueta cuenta como destacado y va al final.
 */
export const OFFER_PRIORITY: readonly string[] = ['Promoción', 'Más vendido', 'Nuevo']
export const OFFERS_MAX = 6

/** Minúsculas y sin tildes, para que "proteina" encuentre "Proteína". */
export function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function visibleCategories(categorias: readonly CatalogoCategoria[]): CatalogoCategoria[] {
  return categorias.filter((cat) => !HIDDEN_CATEGORIES.includes(cat.nombre))
}

export function filterProducts(
  productos: readonly CatalogoProducto[],
  options: { categoryId: 'all' | string; search: string },
): CatalogoProducto[] {
  const query = normalize(options.search)
  return productos.filter((p) => {
    if (options.categoryId !== 'all' && p.categoriaId !== options.categoryId) return false
    if (!query) return true
    const haystack = normalize(
      [p.nombre, p.marca, p.categoriaNombre, p.etiqueta, p.paraQueSirve].filter(Boolean).join(' '),
    )
    return haystack.includes(query)
  })
}

export function selectOffers(productos: readonly CatalogoProducto[]): CatalogoProducto[] {
  const priority = (p: CatalogoProducto): number => {
    const i = OFFER_PRIORITY.indexOf(p.etiqueta ?? '')
    return i === -1 ? OFFER_PRIORITY.length : i
  }
  return productos
    .filter((p) => p.etiqueta)
    .sort((a, b) => priority(a) - priority(b) || a.nombre.localeCompare(b.nombre))
    .slice(0, OFFERS_MAX)
}

export function totalPages(count: number, pageSize = PRODUCTS_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(count / pageSize))
}

/** Recorta a la página pedida, tolerando páginas fuera de rango. */
export function paginate<T>(items: readonly T[], page: number, pageSize = PRODUCTS_PAGE_SIZE): T[] {
  const safePage = Math.min(Math.max(1, page), totalPages(items.length, pageSize))
  const start = (safePage - 1) * pageSize
  return items.slice(start, start + pageSize)
}

const SHORT_TEXT_MAX = 92

/** Corta descripciones largas para que la tarjeta no se descuadre. */
export function shortText(value: string, max = SHORT_TEXT_MAX): string {
  const clean = value.trim()
  return clean.length > max ? `${clean.slice(0, max - 3).trim()}...` : clean
}
