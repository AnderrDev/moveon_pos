import { inject, Injectable } from '@angular/core'
import { ProductsCacheStore } from '../products/products-cache.store'
import { InventoryRepository } from '../inventory/inventory.repository'
import { SupabaseClientService } from '../../core/supabase/supabase-client.service'
import type { OpenCashSession, PosCategory, PosProduct } from './pos.types'

interface CashSessionRow {
  id: string
  opening_amount: number
}

@Injectable({ providedIn: 'root' })
export class PosDataService {
  private readonly supabaseClient = inject(SupabaseClientService)
  private readonly cache = inject(ProductsCacheStore)
  private readonly inventoryRepo = inject(InventoryRepository)

  async listProducts(tiendaId: string): Promise<PosProduct[]> {
    // 2 queries: catálogo (cache) + niveles de stock (getStockLevels). Sin N+1.
    const [products, stockLevels] = await Promise.all([
      this.cache.ensureProducts(tiendaId),
      this.inventoryRepo.getStockLevels(tiendaId),
    ])

    const stockByProduct = new Map(
      stockLevels.map((level) => [level.productId, level.puntoVentaStock]),
    )

    return products
      .filter((p) => p.isActive)
      .map((p) => ({
        id: p.id,
        nombre: p.nombre,
        sku: p.sku,
        codigoBarras: p.codigoBarras,
        precioVenta: p.precioVenta,
        ivaTasa: p.ivaTasa,
        categoriaId: p.categoriaId,
        paraQueSirve: p.paraQueSirve,
        recomendadoPara: p.recomendadoPara,
        tipo: p.tipo,
        // `prepared` no rastrea stock. Para simple/ingredient, stock real
        // acotado a >= 0 (RN-I06): el máximo nunca es negativo.
        stockDisponible:
          p.tipo === 'prepared' ? null : Math.max(0, stockByProduct.get(p.id) ?? 0),
      }))
  }

  async listCategories(tiendaId: string): Promise<PosCategory[]> {
    const categorias = await this.cache.ensureCategorias(tiendaId)
    return categorias
      .filter((c) => c.isActive)
      .map((c) => ({ id: c.id, nombre: c.nombre }))
  }

  async getOpenCashSession(tiendaId: string): Promise<OpenCashSession | null> {
    const { data, error } = await this.supabaseClient.supabase
      .from('cash_sessions')
      .select('id, opening_amount')
      .eq('tienda_id', tiendaId)
      .eq('status', 'open')
      .maybeSingle()
      .returns<CashSessionRow>()

    if (error) throw new Error(error.message)
    if (!data) return null

    return {
      id: data.id,
      openingAmount: data.opening_amount,
    }
  }
}
