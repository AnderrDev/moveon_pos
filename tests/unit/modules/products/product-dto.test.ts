import { describe, expect, it } from 'vitest'
import {
  createCategoriaSchema as createCategoriaDtoSchema,
  createProductSchema,
  searchProductsSchema,
  updateProductSchema,
} from '@/modules/products/application/dtos/product.dto'
import {
  createCategoriaSchema,
  updateCategoriaSchema,
} from '@/modules/products/application/dtos/categoria.dto'

const tiendaId = '11111111-1111-4111-8111-111111111111'
const categoriaId = '22222222-2222-4222-8222-222222222222'

describe('product DTO schemas', () => {
  const validProduct = {
    tiendaId,
    nombre: 'Whey Protein',
    sku: 'WHY-001',
    codigoBarras: '770000000001',
    categoriaId,
    tipo: 'simple',
    unidad: 'und',
    precioVenta: 100000,
    costo: 70000,
    ivaTasa: 19,
    stockMinimo: 2,
    isActive: true,
  }

  it('acepta producto de creación válido', () => {
    expect(createProductSchema.safeParse(validProduct).success).toBe(true)
  })

  it('rechaza precio de venta no positivo', () => {
    expect(createProductSchema.safeParse({ ...validProduct, precioVenta: 0 }).success).toBe(false)
  })

  it('permite updates parciales sin tiendaId', () => {
    expect(updateProductSchema.safeParse({ nombre: 'Creatina' }).success).toBe(true)
  })

  it('aplica defaults de búsqueda', () => {
    const result = searchProductsSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.soloActivos).toBe(true)
      expect(result.data.page).toBe(1)
      expect(result.data.limit).toBe(20)
    }
  })

  it('limita tamaño de página de búsqueda', () => {
    expect(searchProductsSchema.safeParse({ limit: 101 }).success).toBe(false)
  })
})

describe('categoria DTO schemas', () => {
  it('aceptan categorías válidas', () => {
    expect(createCategoriaSchema.safeParse({ nombre: 'Proteínas' }).success).toBe(true)
    expect(updateCategoriaSchema.safeParse({ nombre: 'Creatinas' }).success).toBe(true)
  })

  it('rechazan categorías vacías', () => {
    expect(createCategoriaSchema.safeParse({ nombre: '   ' }).success).toBe(false)
    expect(updateCategoriaSchema.safeParse({ nombre: '' }).success).toBe(false)
  })

  it('acepta DTO legacy de categoría con tienda', () => {
    const result = createCategoriaDtoSchema.safeParse({
      tiendaId,
      nombre: 'Snacks',
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.orden).toBe(0)
  })
})
