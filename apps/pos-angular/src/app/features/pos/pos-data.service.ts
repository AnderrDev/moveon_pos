import { inject, Injectable } from '@angular/core'
import { ProductsCacheStore } from '../products/products-cache.store'
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

  async listProducts(tiendaId: string): Promise<PosProduct[]> {
    const products = await this.cache.ensureProducts(tiendaId)
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
