import { tracksOwnStock } from '@/shared/lib/product-type'
import type { Product } from '@angular-app/features/products/domain/entities/product.entity'
import type { StockLevel } from '@angular-app/features/inventory/domain/entities/inventory.entity'
import { isLowStock, isOutOfStock } from '@angular-app/features/inventory/domain/services/low-stock'

/**
 * Stock de un producto tal como lo muestra la pantalla unificada de
 * Productos (antes /inventario). Preparados y combos no llevan stock propio:
 * `tracksStock = false` y nunca están bajos ni agotados.
 */
export interface ProductStock {
  tracksStock: boolean
  puntoVentaStock: number
  bodegaStock: number
  totalStock: number
  isLow: boolean
  isOut: boolean
}

export type ProductStockStatus = 'out' | 'low' | 'ok' | 'none'

export function buildProductStock(product: Product, level: StockLevel | undefined): ProductStock {
  const tracksStock = tracksOwnStock(product.tipo)
  const puntoVentaStock = level?.puntoVentaStock ?? 0
  const bodegaStock = level?.bodegaStock ?? 0
  return {
    tracksStock,
    puntoVentaStock,
    bodegaStock,
    totalStock: level?.totalStock ?? puntoVentaStock + bodegaStock,
    isLow: isLowStock({ tipo: product.tipo, currentStock: puntoVentaStock, minimumStock: product.stockMinimo }),
    isOut: isOutOfStock({ tipo: product.tipo, currentStock: puntoVentaStock }),
  }
}

export function productStockStatus(stock: ProductStock): ProductStockStatus {
  if (!stock.tracksStock) return 'none'
  if (stock.isOut) return 'out'
  if (stock.isLow) return 'low'
  return 'ok'
}

/** "Solo faltantes": agotados o en el mínimo (o por debajo) en punto de venta. */
export function isMissingStock(stock: ProductStock): boolean {
  return stock.isOut || stock.isLow
}
