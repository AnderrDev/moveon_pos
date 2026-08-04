import { inject, Injectable } from '@angular/core'
import { ProductsCacheStore } from '@angular-app/core/catalog/products-cache.store'
import { InventoryRepository } from '@angular-app/features/inventory/domain/repositories/inventory.repository'
import { SupabaseClientService } from '@angular-app/core/supabase/supabase-client.service'
import { SessionService } from '@angular-app/core/auth/session.service'
import type { OpenCashSession, PosCategory, PosProduct, PosProductComponent, PosProductOption } from '@angular-app/features/pos/presentation/services/pos.types'
import { deriveComboStock } from '@angular-app/features/pos/presentation/services/combo-stock'

interface CashSessionRow {
  id: string
  opening_amount: number
}

interface ComponentRow {
  producto_id: string
  componente_id: string
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

interface OptionRow {
  id: string
  producto_id: string
  grupo: string
  nombre: string
  precio_extra: number
  es_default: boolean
  orden: number
}

interface ProductOptionsClient {
  from(table: 'product_options'): {
    select(cols: string): {
      eq(
        col: 'tienda_id',
        value: string,
      ): {
        eq(
          col: 'is_active',
          value: boolean,
        ): {
          order(col: 'orden'): Promise<{
            data: OptionRow[] | null
            error: { message: string } | null
          }>
        }
      }
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

    const [products, stockLevels, componentRows, optionRows] = await Promise.all([
      this.cache.ensureProducts(tiendaId),
      this.inventoryRepo.getStockLevels(tiendaId),
      this.fetchComponents(tiendaId),
      this.fetchOptions(tiendaId),
    ])

    const stockByProduct = new Map(
      stockLevels.map((level) => [level.productId, level.puntoVentaStock])
    )

    const componentsByProduct = new Map<string, PosProductComponent[]>()
    for (const row of componentRows) {
      const list = componentsByProduct.get(row.producto_id) ?? []
      list.push({
        componenteId: row.componente_id,
        nombre: row.componente.nombre,
        cantidad: row.cantidad,
      })
      componentsByProduct.set(row.producto_id, list)
    }

    const optionsByProduct = new Map<string, PosProductOption[]>()
    for (const row of optionRows) {
      const list = optionsByProduct.get(row.producto_id) ?? []
      list.push({
        id: row.id,
        grupo: row.grupo,
        nombre: row.nombre,
        precioExtra: Number(row.precio_extra),
        esDefault: row.es_default,
      })
      optionsByProduct.set(row.producto_id, list)
    }

    return products
      .filter((p) => p.isActive)
      .map((p) => {
        const components = componentsByProduct.get(p.id) ?? []

        return {
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
          stockDisponible: this.resolveStock(p.tipo, p.id, components, stockByProduct),
          components,
          options: optionsByProduct.get(p.id) ?? [],
        }
      })
  }

  /**
   * - `prepared`: no rastrea stock y no se deriva (los ingredientes de un batido
   *   no se miden por unidad vendida) → `null`, nunca topa la cantidad.
   * - `combo`: sin stock propio, pero sí derivable del producto incluido más
   *   escaso (ADR 0018).
   * - resto: stock real acotado a >= 0 (RN-I06), el máximo nunca es negativo.
   */
  private resolveStock(
    tipo: PosProduct['tipo'],
    productId: string,
    components: PosProductComponent[],
    stockByProduct: Map<string, number>,
  ): number | null {
    if (tipo === 'prepared') return null

    if (tipo === 'combo') {
      return deriveComboStock(
        components.map((c) => ({
          cantidad: c.cantidad,
          stockDisponible: Math.max(0, stockByProduct.get(c.componenteId) ?? 0),
        })),
      )
    }

    return Math.max(0, stockByProduct.get(productId) ?? 0)
  }

  private async fetchComponents(tiendaId: string): Promise<ComponentRow[]> {
    const db = this.supabaseClient.supabase as unknown as ProductComponentsClient
    const { data, error } = await db
      .from('product_components')
      .select('producto_id, componente_id, cantidad, componente:componente_id(nombre)')
      .eq('tienda_id', tiendaId)

    if (error) throw new Error((error as { message: string }).message)
    return (data ?? []) as ComponentRow[]
  }

  /** Opciones activas de venta (ADR 0017), ordenadas como se muestran al cajero. */
  private async fetchOptions(tiendaId: string): Promise<OptionRow[]> {
    const db = this.supabaseClient.supabase as unknown as ProductOptionsClient
    const { data, error } = await db
      .from('product_options')
      .select('id, producto_id, grupo, nombre, precio_extra, es_default, orden')
      .eq('tienda_id', tiendaId)
      .eq('is_active', true)
      .order('orden')

    if (error) throw new Error((error as { message: string }).message)
    return (data ?? []) as OptionRow[]
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
