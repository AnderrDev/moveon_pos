import type { PosProduct, PosProductOption } from '@angular-app/features/pos/presentation/services/pos.types'

// Reglas del catálogo del POS (TS puro). Antes vivían en `pos.page.ts`.

/**
 * Filtra por categoría y por término (nombre o SKU que contengan el término,
 * o código de barras exacto) y deja los agotados al final.
 */
export function filterCatalog(products: PosProduct[], query: string, categoryId: string | null): PosProduct[] {
  const raw = query.trim()
  const q = raw.toLowerCase()
  const filtered = products.filter((product) => {
    if (categoryId !== null && product.categoriaId !== categoryId) return false
    if (!q) return true
    return (
      product.nombre.toLowerCase().includes(q) ||
      (product.sku?.toLowerCase().includes(q) ?? false) ||
      product.codigoBarras === raw
    )
  })
  return [
    ...filtered.filter((product) => product.stockDisponible !== 0),
    ...filtered.filter((product) => product.stockDisponible === 0),
  ]
}

/** `true` cuando el producto rastrea stock y no hay unidades en punto de venta. */
export function isOutOfStock(product: Pick<PosProduct, 'stockDisponible'>): boolean {
  return product.stockDisponible === 0
}

/** Texto del indicador de stock de la tarjeta de producto. */
export function productStockLabel(stockDisponible: number | null): string {
  if (stockDisponible === null) return 'Bajo pedido'
  if (stockDisponible === 0) return 'Agotado'
  if (stockDisponible === 1) return '1 disponible'
  return `${stockDisponible} disponibles`
}

/**
 * Opción con la que entra el producto al tocarlo: la predeterminada o, si no
 * hay, la primera. Vender es un toque; cambiarla se hace desde el carrito.
 */
export function preferredOption(product: Pick<PosProduct, 'options'>): PosProductOption | null {
  return product.options.find((o) => o.esDefault) ?? product.options[0] ?? null
}
