import { describe, expect, it } from 'vitest'
import {
  filterCatalog,
  isOutOfStock,
  preferredOption,
  productStockLabel,
} from '@angular-app/features/pos/presentation/services/pos-catalog'
import type { PosProduct } from '@angular-app/features/pos/presentation/services/pos.types'

function product(id: string, overrides: Partial<PosProduct> = {}): PosProduct {
  return {
    id, nombre: id, sku: null, codigoBarras: null, precioVenta: 1000, costo: null, ivaTasa: 0,
    categoriaId: null, paraQueSirve: null, recomendadoPara: null, tipo: 'simple',
    participaFidelizacion: true, stockDisponible: 5, components: [], options: [],
    ...overrides,
  } as PosProduct
}

describe('filterCatalog', () => {
  const items = [
    product('Whey', { sku: 'WHY-1', categoriaId: 'prot', stockDisponible: 0 }),
    product('Creatina', { sku: 'CRE-1', categoriaId: 'crea', codigoBarras: '7701' }),
    product('Batido', { categoriaId: 'prot', stockDisponible: null }),
  ]

  it('filtra por categoría y deja los agotados al final', () => {
    expect(filterCatalog(items, '', 'prot').map((p) => p.id)).toEqual(['Batido', 'Whey'])
  })

  it('busca por nombre o SKU sin distinguir mayúsculas, y por código de barras exacto', () => {
    expect(filterCatalog(items, 'why', null).map((p) => p.id)).toEqual(['Whey'])
    expect(filterCatalog(items, ' 7701 ', null).map((p) => p.id)).toEqual(['Creatina'])
    expect(filterCatalog(items, '770', null)).toEqual([])
  })
})

describe('stock y opción preferida', () => {
  it('etiqueta el stock como lo ve el cajero', () => {
    expect([null, 0, 1, 7].map(productStockLabel)).toEqual(['Bajo pedido', 'Agotado', '1 disponible', '7 disponibles'])
    expect(isOutOfStock({ stockDisponible: 0 })).toBe(true)
    expect(isOutOfStock({ stockDisponible: null })).toBe(false)
  })

  it('usa la opción predeterminada o la primera', () => {
    const a = { id: 'a', grupo: 'P', nombre: 'A', precioExtra: 0, esDefault: false }
    const b = { id: 'b', grupo: 'P', nombre: 'B', precioExtra: 0, esDefault: true }
    expect(preferredOption({ options: [a, b] })?.id).toBe('b')
    expect(preferredOption({ options: [a] })?.id).toBe('a')
    expect(preferredOption({ options: [] })).toBeNull()
  })
})
