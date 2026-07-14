import { describe, expect, it } from 'vitest'
import {
  rowToProductComponent,
  filterComponentCandidates,
  buildComponentInsertRows,
  type ProductComponentRow,
} from '@angular-app/features/products/product-component.helpers'
import type { Product } from '@/modules/products/domain/entities/product.entity'

// ─── fixtures ───────────────────────────────────────────────────────────────

const now = new Date('2026-06-15T00:00:00Z')

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'product-1',
    tiendaId: 'tienda-1',
    nombre: 'Vaso 16oz',
    sku: null,
    codigoBarras: null,
    categoriaId: null,
    proveedor: null,
    paraQueSirve: null,
    recomendadoPara: null,
    imageUrl: null,
    tipo: 'ingredient',
    unidad: 'und',
    precioVenta: 0,
    costo: null,
    ivaTasa: 0,
    stockMinimo: 0,
    isActive: true,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

// ─── rowToProductComponent ───────────────────────────────────────────────────

describe('rowToProductComponent', () => {
  it('mapea fila de DB a ProductComponent', () => {
    const row: ProductComponentRow = {
      componente_id: 'vaso-uuid',
      cantidad: '1',
      productos: { nombre: 'Vaso 16oz' },
    }
    expect(rowToProductComponent(row)).toEqual({
      componenteId: 'vaso-uuid',
      componenteNombre: 'Vaso 16oz',
      cantidad: 1,
    })
  })

  it('usa cadena vacía si el join de producto viene null', () => {
    const row: ProductComponentRow = {
      componente_id: 'vaso-uuid',
      cantidad: 1,
      productos: null,
    }
    expect(rowToProductComponent(row).componenteNombre).toBe('')
  })

  it('convierte cantidad string a number', () => {
    const row: ProductComponentRow = {
      componente_id: 'comp-uuid',
      cantidad: '2.5',
      productos: { nombre: 'Leche Almendras' },
    }
    expect(rowToProductComponent(row).cantidad).toBe(2.5)
  })
})

// ─── filterComponentCandidates ───────────────────────────────────────────────

describe('filterComponentCandidates', () => {
  const vaso = makeProduct({ id: 'vaso-1', tipo: 'ingredient', nombre: 'Vaso 16oz' })
  const leche = makeProduct({ id: 'leche-1', tipo: 'ingredient', nombre: 'Leche Almendras' })
  const whey = makeProduct({ id: 'whey-1', tipo: 'simple', nombre: 'Whey Protein', precioVenta: 110_000 })
  const batido = makeProduct({ id: 'batido-1', tipo: 'prepared', nombre: 'Batido en Leche', precioVenta: 12_000 })
  const inactivo = makeProduct({ id: 'inac-1', tipo: 'ingredient', nombre: 'Inactivo', isActive: false })

  const allProducts = [vaso, leche, whey, batido, inactivo]

  it('devuelve solo ingredientes activos', () => {
    const result = filterComponentCandidates(allProducts, new Set(), undefined)
    expect(result).toEqual([vaso, leche])
  })

  it('excluye el producto que se está editando (selfId)', () => {
    const result = filterComponentCandidates(allProducts, new Set(), 'vaso-1')
    expect(result.map((p) => p.id)).not.toContain('vaso-1')
    expect(result.map((p) => p.id)).toContain('leche-1')
  })

  it('excluye componentes ya asignados', () => {
    const result = filterComponentCandidates(allProducts, new Set(['leche-1']), undefined)
    expect(result.map((p) => p.id)).not.toContain('leche-1')
    expect(result.map((p) => p.id)).toContain('vaso-1')
  })

  it('excluye productos no activos aunque sean ingredientes', () => {
    const result = filterComponentCandidates(allProducts, new Set(), undefined)
    expect(result.map((p) => p.id)).not.toContain('inac-1')
  })

  it('no incluye productos simple ni prepared', () => {
    const result = filterComponentCandidates(allProducts, new Set(), undefined)
    const tipos = result.map((p) => p.tipo)
    expect(tipos.every((t) => t === 'ingredient')).toBe(true)
  })

  it('devuelve lista vacía si no hay ingredientes disponibles', () => {
    const sinIngredientes = [whey, batido]
    expect(filterComponentCandidates(sinIngredientes, new Set(), undefined)).toEqual([])
  })
})

// ─── buildComponentInsertRows ────────────────────────────────────────────────

describe('buildComponentInsertRows', () => {
  it('construye las filas con todos los campos requeridos', () => {
    const rows = buildComponentInsertRows('batido-uuid', 'tienda-uuid', [
      { componenteId: 'vaso-uuid', cantidad: 1 },
      { componenteId: 'leche-uuid', cantidad: 200 },
    ])
    expect(rows).toEqual([
      { tienda_id: 'tienda-uuid', producto_id: 'batido-uuid', componente_id: 'vaso-uuid', cantidad: 1 },
      { tienda_id: 'tienda-uuid', producto_id: 'batido-uuid', componente_id: 'leche-uuid', cantidad: 200 },
    ])
  })

  it('devuelve array vacío cuando no hay componentes (saveComponents no inserta)', () => {
    expect(buildComponentInsertRows('batido-uuid', 'tienda-uuid', [])).toEqual([])
  })

  it('propaga el tienda_id y producto_id a todas las filas', () => {
    const rows = buildComponentInsertRows('prod-X', 'tienda-Y', [
      { componenteId: 'c1', cantidad: 1 },
      { componenteId: 'c2', cantidad: 3 },
    ])
    expect(rows.every((r) => r['tienda_id'] === 'tienda-Y')).toBe(true)
    expect(rows.every((r) => r['producto_id'] === 'prod-X')).toBe(true)
  })
})
