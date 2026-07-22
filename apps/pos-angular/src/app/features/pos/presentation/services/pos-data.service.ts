import { inject, Injectable } from '@angular/core'
import { ProductsCacheStore } from '@angular-app/core/catalog/products-cache.store'
import { InventoryRepository } from '@angular-app/features/inventory/domain/repositories/inventory.repository'
import { SupabaseClientService } from '@angular-app/core/supabase/supabase-client.service'
import { SessionService } from '@angular-app/core/auth/session.service'
import type { OpenCashSession, PosCategory, PosProduct, PosProductComponent } from '@angular-app/features/pos/presentation/services/pos.types'

interface CashSessionRow {
  id: string
  opening_amount: number
}

interface ComponentRow {
  producto_id: string
  cantidad: number
  componente: { nombre: string }
}

interface ProductComponentsClient {
  from(table: 'product_components'): {
    select(cols: string): {
      eq(col: 'tienda_id', value: string): Promise<{
        data: ComponentRow[] | null
        error: { message: string } | null
      }>
    }
  }
}

@Injectable({ providedIn: 'root' })
export class PosDataService {
  private readonly supabaseClient = inject(SupabaseClientService)
  private readonly session = inject(SessionService)
  private readonly cache = inject(ProductsCacheStore)
  private readonly inventoryRepo = inject(InventoryRepository)

  async listProducts(tiendaId: string): Promise<PosProduct[]> {
    const canViewCost = (await this.session.getRole()) === 'admin'

    const [products, stockLevels, componentRows] = await Promise.all([
      this.cache.ensureProducts(tiendaId),
      this.inventoryRepo.getStockLevels(tiendaId),
      this.fetchComponents(tiendaId),
    ])

    const stockByProduct = new Map(
      stockLevels.map((level) => [level.productId, level.puntoVentaStock])
    )

    const componentsByProduct = new Map<string, PosProductComponent[]>()
    for (const row of componentRows) {
      const list = componentsByProduct.get(row.producto_id) ?? []
      list.push({ nombre: row.componente.nombre, cantidad: row.cantidad })
      componentsByProduct.set(row.producto_id, list)
    }

    return products
      .filter((p) => p.isActive)
      .map((p) => ({
        id: p.id,
        nombre: p.nombre,
        sku: p.sku,
        codigoBarras: p.codigoBarras,
        precioVenta: p.precioVenta,
        costo: canViewCost ? p.costo : null,
        ivaTasa: p.ivaTasa,
        categoriaId: p.categoriaId,
        paraQueSirve: p.paraQueSirve,
        recomendadoPara: p.recomendadoPara,
        tipo: p.tipo,
        participaFidelizacion: p.participaFidelizacion,
        // `prepared` no rastrea stock. Para simple/ingredient, stock real
        // acotado a >= 0 (RN-I06): el máximo nunca es negativo.
        stockDisponible: p.tipo === 'prepared' ? null : Math.max(0, stockByProduct.get(p.id) ?? 0),
        components: componentsByProduct.get(p.id) ?? [],
      }))
  }

  private async fetchComponents(tiendaId: string): Promise<ComponentRow[]> {
    const db = this.supabaseClient.supabase as unknown as ProductComponentsClient
    const { data, error } = await db
      .from('product_components')
      .select('producto_id, cantidad, componente:componente_id(nombre)')
      .eq('tienda_id', tiendaId)

    if (error) throw new Error((error as { message: string }).message)
    return (data ?? []) as ComponentRow[]
  }

  async listCategories(tiendaId: string): Promise<PosCategory[]> {
    const categorias = await this.cache.ensureCategorias(tiendaId)
    return categorias.filter((c) => c.isActive).map((c) => ({ id: c.id, nombre: c.nombre }))
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
