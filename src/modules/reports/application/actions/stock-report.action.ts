'use server'

import { getAuthContext } from '@/shared/lib/auth-context'
import { SupabaseInventoryRepository } from '@/modules/inventory/infrastructure/repositories/supabase-inventory.repository'
import { SupabaseProductRepository } from '@/modules/products/infrastructure/repositories/supabase-product.repository'

export type StockReportRow = {
  productId: string
  nombre: string
  sku: string | null
  currentStock: number
  minimumStock: number
  isLow: boolean
}

export async function getStockReportAction(): Promise<StockReportRow[]> {
  const auth = await getAuthContext()
  if (!auth) return []

  const invRepo     = new SupabaseInventoryRepository()
  const productRepo = new SupabaseProductRepository()

  const [stockResult, productosResult] = await Promise.all([
    invRepo.getStockLevels(auth.tiendaId),
    productRepo.search({ tiendaId: auth.tiendaId, soloActivos: true, limit: 500 }),
  ])

  if (!stockResult.ok || !productosResult.ok) return []

  const productMap = Object.fromEntries(productosResult.value.map((p) => [p.id, p]))

  return stockResult.value
    .filter((sl) => productMap[sl.productId])
    .map((sl) => {
      const p = productMap[sl.productId]
      return {
        productId:    sl.productId,
        nombre:       p.nombre,
        sku:          p.sku,
        currentStock: sl.currentStock,
        minimumStock: sl.minimumStock,
        isLow:        sl.isLow,
      }
    })
    .sort((a, b) => {
      if (a.isLow !== b.isLow) return a.isLow ? -1 : 1
      return a.nombre.localeCompare(b.nombre)
    })
}
