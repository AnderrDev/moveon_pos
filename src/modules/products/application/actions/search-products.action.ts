'use server'

import { getAuthContext } from '@/shared/lib/auth-context'
import { SupabaseProductRepository } from '../../infrastructure/repositories/supabase-product.repository'

export type ProductSearchResult = {
  id: string
  nombre: string
  sku: string | null
  codigoBarras: string | null
  precioVenta: number
  ivaTasa: number
}

export async function searchProductsAction(query: string): Promise<ProductSearchResult[]> {
  const auth = await getAuthContext()
  if (!auth) return []

  const repo = new SupabaseProductRepository()
  const result = await repo.search({
    tiendaId:   auth.tiendaId,
    query:      query.trim(),
    soloActivos: true,
    limit:      10,
  })

  if (!result.ok) return []

  return result.value.map((p) => ({
    id:           p.id,
    nombre:       p.nombre,
    sku:          p.sku,
    codigoBarras: p.codigoBarras,
    precioVenta:  p.precioVenta,
    ivaTasa:      p.ivaTasa,
  }))
}
