import { describe, expect, it } from 'vitest'
import {
  createProductSchema,
  searchProductsSchema,
  updateProductSchema,
} from '@angular-app/features/products/domain/dtos/product.dto'
import {
  createCategoriaSchema,
  updateCategoriaSchema,
} from '@angular-app/features/products/domain/dtos/categoria.dto'
import { createProveedorSchema } from '@angular-app/features/products/domain/dtos/proveedor.dto'

const tiendaId = '11111111-1111-4111-8111-111111111111'
const categoriaId = '22222222-2222-4222-8222-222222222222'

describe('product DTO schemas', () => {
  const validProduct = {
    tiendaId,
    nombre: 'Whey Protein',
    sku: 'WHY-001',
    codigoBarras: '770000000001',
    categoriaId,
    paraQueSirve: 'Apoya la recuperacion muscular.',
    recomendadoPara: 'Personas activas.',
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

  it('acepta precio de venta en cero', () => {
    expect(createProductSchema.safeParse({ ...validProduct, precioVenta: 0 }).success).toBe(true)
  })

  it('rechaza informacion comercial demasiado larga', () => {
    expect(
      createProductSchema.safeParse({ ...validProduct, recomendadoPara: 'a'.repeat(801) }).success,
    ).toBe(false)
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
})

describe('proveedor DTO schema', () => {
  it('acepta un proveedor válido', () => {
    expect(createProveedorSchema.safeParse({ nombre: 'Distribuidora Healthy' }).success).toBe(true)
  })

  it('rechaza nombre vacío', () => {
    expect(createProveedorSchema.safeParse({ nombre: '   ' }).success).toBe(false)
  })

  it('rechaza nombre que supera el límite', () => {
    expect(createProveedorSchema.safeParse({ nombre: 'a'.repeat(101) }).success).toBe(false)
  })
})
