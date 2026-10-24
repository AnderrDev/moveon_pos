import { inject, Injectable } from '@angular/core'
import { ProductsCacheStore } from '@angular-app/core/catalog/products-cache.store'
import { InventoryRepository } from '@angular-app/features/inventory/domain/repositories/inventory.repository'
import { ProductRepository } from '@angular-app/features/products/domain/repositories/product.repository'
import { CashRegisterRepository } from '@angular-app/features/cash-register/domain/repositories/cash-register.repository'
import { SessionService } from '@angular-app/core/auth/session.service'
import type { OpenCashSession, PosCategory, PosProduct, PosProductComponent, PosProductOption } from '@angular-app/features/pos/presentation/services/pos.types'
import { deriveComboStock } from '@angular-app/features/pos/presentation/services/combo-stock'

/**
 * Arma el catálogo del POS (productos + stock + componentes + opciones) y la
 * caja abierta. Solo lee por las abstracciones de cada feature: no conoce
 * Supabase (ADR 0015).
 */
@Injectable({ providedIn: 'root' })
export class PosDataService {
  private readonly session = inject(SessionService)
  private readonly cache = inject(ProductsCacheStore)
  private readonly inventoryRepo = inject(InventoryRepository)
  private readonly productRepo = inject(ProductRepository)
  private readonly cashRepo = inject(CashRegisterRepository)

  async listProducts(tiendaId: string): Promise<PosProduct[]> {
    const canViewCost = (await this.session.getRole()) === 'admin'

    const [products, stockLevels, componentLinks, optionLinks] = await Promise.all([
      this.cache.ensureProducts(tiendaId),
      this.inventoryRepo.getStockLevels(tiendaId),
      this.productRepo.listComponentsByTienda(tiendaId),
      this.productRepo.listActiveOptionsByTienda(tiendaId),
    ])

    const stockByProduct = new Map(
      stockLevels.map((level) => [level.productId, level.puntoVentaStock])
    )

    const componentsByProduct = new Map<string, PosProductComponent[]>()
    for (const link of componentLinks) {
      const list = componentsByProduct.get(link.productoId) ?? []
      list.push({
        componenteId: link.componenteId,
        nombre: link.componenteNombre,
        cantidad: link.cantidad,
      })
      componentsByProduct.set(link.productoId, list)
    }

    const optionsByProduct = new Map<string, PosProductOption[]>()
    for (const link of optionLinks) {
      const list = optionsByProduct.get(link.productoId) ?? []
      list.push({
        id: link.id,
        grupo: link.grupo,
        nombre: link.nombre,
        precioExtra: link.precioExtra,
        esDefault: link.esDefault,
      })
      optionsByProduct.set(link.productoId, list)
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

  async listCategories(tiendaId: string): Promise<PosCategory[]> {
    const categorias = await this.cache.ensureCategorias(tiendaId)
    return categorias.filter((c) => c.isActive).map((c) => ({ id: c.id, nombre: c.nombre }))
  }

  async getOpenCashSession(tiendaId: string): Promise<OpenCashSession | null> {
    const session = await this.cashRepo.getOpenSession(tiendaId)
    return session ? { id: session.id, openingAmount: session.openingAmount } : null
  }
}
