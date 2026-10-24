import '@angular/compiler'
import { Injector, runInInjectionContext } from '@angular/core'
import { describe, expect, it } from 'vitest'
import { ProductsCacheStore } from '@angular-app/core/catalog/products-cache.store'
import { SessionService } from '@angular-app/core/auth/session.service'
import { InventoryRepository } from '@angular-app/features/inventory/domain/repositories/inventory.repository'
import { ProductRepository } from '@angular-app/features/products/domain/repositories/product.repository'
import { CashRegisterRepository } from '@angular-app/features/cash-register/domain/repositories/cash-register.repository'
import { PosDataService } from '@angular-app/features/pos/presentation/services/pos-data.service'

// PosDataService arma el catálogo del POS solo con abstracciones de cada
// feature (sin Supabase). Se prueba con dobles de esas abstracciones.

function product(id: string, tipo: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    nombre: id,
    sku: null,
    codigoBarras: null,
    precioVenta: 10000,
    costo: 4000,
    ivaTasa: 0,
    categoriaId: null,
    paraQueSirve: null,
    recomendadoPara: null,
    tipo,
    participaFidelizacion: true,
    isActive: true,
    ...overrides,
  }
}

function makeService(role: 'admin' | 'cajero') {
  const injector = Injector.create({
    providers: [
      { provide: SessionService, useValue: { getRole: async () => role } },
      {
        provide: ProductsCacheStore,
        useValue: {
          ensureProducts: async () => [
            product('whey', 'simple'),
            product('leche', 'ingredient'),
            product('batido', 'prepared'),
            product('combo', 'combo'),
            product('inactivo', 'simple', { isActive: false }),
          ],
        },
      },
      {
        provide: InventoryRepository,
        useValue: {
          getStockLevels: async () => [
            { productId: 'whey', puntoVentaStock: 7 },
            { productId: 'leche', puntoVentaStock: -2 },
          ],
        },
      },
      {
        provide: ProductRepository,
        useValue: {
          listComponentsByTienda: async () => [
            { productoId: 'batido', componenteId: 'leche', componenteNombre: 'Leche', cantidad: 1 },
            { productoId: 'combo', componenteId: 'whey', componenteNombre: 'Whey', cantidad: 2 },
          ],
          listActiveOptionsByTienda: async () => [
            {
              id: 'opt-1', productoId: 'batido', grupo: 'Proteína', nombre: 'Whey', precioExtra: 3000,
              componenteId: 'whey', componenteNombre: 'Whey', componenteCantidad: 1, esDefault: true,
            },
            {
              id: 'opt-2', productoId: 'batido', grupo: 'Proteína', nombre: 'Vegana', precioExtra: 4000,
              componenteId: null, componenteNombre: '', componenteCantidad: 0, esDefault: false,
            },
          ],
        },
      },
      {
        provide: CashRegisterRepository,
        useValue: { getOpenSession: async () => ({ id: 'sesion-1', openingAmount: 125000, status: 'open' }) },
      },
    ],
  })
  return runInInjectionContext(injector, () => new PosDataService())
}

describe('PosDataService.listProducts', () => {
  it('excluye inactivos y agrupa componentes y opciones por producto, en orden', async () => {
    const products = await makeService('admin').listProducts('tienda-1')
    expect(products.map((p) => p.id)).toEqual(['whey', 'leche', 'batido', 'combo'])

    const batido = products.find((p) => p.id === 'batido')
    expect(batido?.components).toEqual([{ componenteId: 'leche', nombre: 'Leche', cantidad: 1 }])
    expect(batido?.options).toEqual([
      { id: 'opt-1', grupo: 'Proteína', nombre: 'Whey', precioExtra: 3000, esDefault: true },
      { id: 'opt-2', grupo: 'Proteína', nombre: 'Vegana', precioExtra: 4000, esDefault: false },
    ])
  })

  it('resuelve el stock: real acotado a 0, preparado sin tope y combo derivado', async () => {
    const products = await makeService('admin').listProducts('tienda-1')
    const stock = Object.fromEntries(products.map((p) => [p.id, p.stockDisponible]))
    expect(stock).toEqual({ whey: 7, leche: 0, batido: null, combo: 3 })
  })

  it('oculta el costo a cajeros', async () => {
    const admin = await makeService('admin').listProducts('tienda-1')
    const cajero = await makeService('cajero').listProducts('tienda-1')
    expect(admin[0]?.costo).toBe(4000)
    expect(cajero.every((p) => p.costo === null)).toBe(true)
  })
})

describe('PosDataService.getOpenCashSession', () => {
  it('lee la caja abierta por CashRegisterRepository', async () => {
    await expect(makeService('cajero').getOpenCashSession('tienda-1')).resolves.toEqual({
      id: 'sesion-1',
      openingAmount: 125000,
    })
  })
})
