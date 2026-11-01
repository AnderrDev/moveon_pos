import { describe, expect, it } from 'vitest'
import type { Product } from '@angular-app/features/products/domain/entities/product.entity'
import type { StockLevel } from '@angular-app/features/inventory/domain/entities/inventory.entity'
import {
  buildProductStock,
  countProductViews,
  isMissingStock,
  marginPercent,
  matchesProductView,
  productStockStatus,
} from '@angular-app/features/products/presentation/services/product-stock'
import { buildProductsWorkbook } from '@angular-app/features/products/presentation/services/product-export'

const tiendaId = '11111111-1111-4111-8111-111111111111'

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p-whey',
    tiendaId,
    nombre: 'Whey Protein',
    sku: 'WHY-001',
    codigoBarras: null,
    categoriaId: null,
    proveedorId: null,
    proveedorNombre: 'Distribuidora Healthy',
    paraQueSirve: null,
    recomendadoPara: null,
    imageUrl: null,
    tipo: 'simple',
    unidad: 'und',
    precioVenta: 110000,
    costo: 70000,
    ivaTasa: 0,
    stockMinimo: 2,
    participaFidelizacion: false,
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
    deletedAt: null,
    ...overrides,
  }
}

function level(productId: string, puntoVentaStock: number, bodegaStock: number): StockLevel {
  return {
    productId,
    tiendaId,
    puntoVentaStock,
    bodegaStock,
    totalStock: puntoVentaStock + bodegaStock,
    minimumStock: 2,
    isLow: false,
  }
}

describe('stock en la pantalla de productos', () => {
  it('marca agotado y stock bajo según el punto de venta', () => {
    const out = buildProductStock(product(), level('p-whey', 0, 10))
    expect(out).toMatchObject({ tracksStock: true, isOut: true, totalStock: 10 })
    expect(productStockStatus(out)).toBe('out')

    const low = buildProductStock(product(), level('p-whey', 2, 0))
    expect(productStockStatus(low)).toBe('low')
    expect(isMissingStock(low)).toBe(true)

    const ok = buildProductStock(product(), level('p-whey', 5, 0))
    expect(productStockStatus(ok)).toBe('ok')
    expect(isMissingStock(ok)).toBe(false)
  })

  it('sin nivel registrado el producto con stock propio está agotado', () => {
    expect(buildProductStock(product(), undefined)).toMatchObject({ puntoVentaStock: 0, isOut: true })
  })

  it('preparados y combos no llevan stock: nunca faltan', () => {
    for (const tipo of ['prepared', 'combo'] as const) {
      const stock = buildProductStock(product({ tipo }), undefined)
      expect(stock).toMatchObject({ tracksStock: false, isOut: false, isLow: false })
      expect(productStockStatus(stock)).toBe('none')
      expect(isMissingStock(stock)).toBe(false)
    }
  })
})

describe('Excel de productos con stock', () => {
  it('incluye proveedor, stock por ubicación y su estado', () => {
    const whey = product()
    const batido = product({ id: 'p-batido', nombre: 'Batido', tipo: 'prepared', proveedorNombre: null })
    const stock = new Map([
      [whey.id, buildProductStock(whey, level(whey.id, 1, 4))],
      [batido.id, buildProductStock(batido, undefined)],
    ])
    const sheet = buildProductsWorkbook([whey, batido], [], '', stock).sheets[0]
    const headers = sheet.columns.map((c) => c.header)
    const col = (name: string) => headers.indexOf(name)

    expect(sheet.rows[0][col('Proveedor')]).toBe('Distribuidora Healthy')
    expect(sheet.rows[0][col('Punto de venta')]).toBe(1)
    expect(sheet.rows[0][col('Bodega')]).toBe(4)
    expect(sheet.rows[0][col('Stock total')]).toBe(5)
    expect(sheet.rows[0][col('Estado del stock')]).toBe('Stock bajo')

    expect(sheet.rows[1][col('Punto de venta')]).toBeNull()
    expect(sheet.rows[1][col('Estado del stock')]).toBe('Sin stock propio')
  })
})

describe('vistas rápidas de productos', () => {
  const level = (productId: string, puntoVentaStock: number): StockLevel =>
    ({ productId, puntoVentaStock, bodegaStock: 0, totalStock: puntoVentaStock }) as StockLevel

  it('"Por reponer" incluye activos agotados o en el mínimo, nunca inactivos ni preparados', () => {
    const items = [
      product({ id: 'ok' }),
      product({ id: 'low' }),
      product({ id: 'out' }),
      product({ id: 'off', isActive: false }),
      product({ id: 'batido', tipo: 'prepared' }),
    ]
    const levels = new Map([
      ['ok', level('ok', 10)],
      ['low', level('low', 2)],
      ['out', level('out', 0)],
      ['off', level('off', 0)],
    ])
    const stockById = new Map(items.map((p) => [p.id, buildProductStock(p, levels.get(p.id))]))

    expect(countProductViews(items, stockById)).toEqual({ active: 4, restock: 2, inactive: 1, all: 5 })
    const restock = items.filter((p) => matchesProductView(p, stockById.get(p.id)!, 'restock'))
    expect(restock.map((p) => p.id)).toEqual(['low', 'out'])
  })

  it('calcula el margen sobre el precio de venta', () => {
    expect(marginPercent(110000, 70000)).toBe(36)
    expect(marginPercent(110000, null)).toBeNull()
    expect(marginPercent(0, 5000)).toBeNull()
  })
})
