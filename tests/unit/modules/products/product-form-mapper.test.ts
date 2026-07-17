import { describe, expect, it } from 'vitest'
import { categoriaFormMapper } from '@/modules/products/forms/categoria-form.mapper'
import { productFormMapper } from '@/modules/products/forms/product-form.mapper'
import type { Product } from '@/modules/products/domain/entities/product.entity'
import type { ProductFormValue } from '@/modules/products/forms/product-form.factory'

const tiendaId = '11111111-1111-4111-8111-111111111111'
const product: Product = {
  id: '22222222-2222-4222-8222-222222222222',
  tiendaId,
  nombre: 'Whey Protein',
  sku: 'why-001',
  codigoBarras: '770000000001',
  categoriaId: '33333333-3333-4333-8333-333333333333',
  proveedor: 'Distribuidora Healthy',
  paraQueSirve: 'Apoya la recuperacion muscular.',
  recomendadoPara: 'Personas activas.',
  imageUrl: null,
  tipo: 'simple',
  unidad: 'und',
  precioVenta: 110000,
  costo: 70000,
  ivaTasa: 19,
  stockMinimo: 2,
  participaFidelizacion: false,
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-02T00:00:00Z'),
  deletedAt: null,
}

const formValue: ProductFormValue = {
  nombre: '  whey protein  ',
  sku: ' why-001 ',
  codigoBarras: ' 770000000001 ',
  categoriaId: '',
  proveedor: ' Distribuidora Healthy ',
  paraQueSirve: '  Apoya la recuperacion muscular.  ',
  recomendadoPara: '  Personas activas.  ',
  imageUrl: '  https://example.com/whey.jpg  ',
  tipo: 'simple',
  unidad: ' und ',
  precioVenta: 110000,
  costo: 70000,
  ivaTasa: 19,
  stockMinimo: 2,
  stockInicial: 15,
  stockInicialUbicacion: 'bodega',
  participaFidelizacion: false,
  isActive: true,
}

describe('categoriaFormMapper', () => {
  it('convierte categoría a valores de formulario', () => {
    expect(categoriaFormMapper.toFormValue({ ...product, nombre: 'Proteínas', orden: 0 })).toEqual({
      nombre: 'Proteínas',
    })
  })

  it('devuelve valores vacíos sin categoría', () => {
    expect(categoriaFormMapper.toFormValue(null)).toEqual({ nombre: '' })
  })
})

describe('productFormMapper', () => {
  it('convierte producto a valores de formulario', () => {
    expect(productFormMapper.toFormValue(product)).toMatchObject({
      nombre: 'Whey Protein',
      sku: 'why-001',
      proveedor: 'Distribuidora Healthy',
      paraQueSirve: 'Apoya la recuperacion muscular.',
      recomendadoPara: 'Personas activas.',
      precioVenta: 110000,
      ivaTasa: 19,
    })
  })

  it('devuelve defaults para producto ausente', () => {
    expect(productFormMapper.toFormValue(null)).toMatchObject({
      nombre: '',
      sku: '',
      tipo: 'simple',
      unidad: 'und',
      precioVenta: 0,
      isActive: true,
    })
  })

  it('normaliza payload de creación', () => {
    expect(productFormMapper.toCreatePayload(formValue, tiendaId)).toEqual({
      tiendaId,
      nombre: 'whey protein',
      sku: 'WHY-001',
      codigoBarras: '770000000001',
      categoriaId: undefined,
      proveedor: 'Distribuidora Healthy',
      paraQueSirve: 'Apoya la recuperacion muscular.',
      recomendadoPara: 'Personas activas.',
      imageUrl: 'https://example.com/whey.jpg',
      tipo: 'simple',
      unidad: 'und',
      precioVenta: 110000,
      costo: 70000,
      ivaTasa: 19,
      stockMinimo: 2,
      participaFidelizacion: false,
      isActive: true,
    })
  })

  it('normaliza payload de actualización', () => {
    expect(productFormMapper.toUpdatePayload(formValue)).toMatchObject({
      nombre: 'whey protein',
      sku: 'WHY-001',
      codigoBarras: '770000000001',
      categoriaId: undefined,
    })
  })

  it('normaliza strings vacíos como undefined en payloads', () => {
    const emptyOptionalValue: ProductFormValue = {
      ...formValue,
      sku: '',
      codigoBarras: '',
      categoriaId: '',
      proveedor: '',
      paraQueSirve: '',
      recomendadoPara: '',
    }

    expect(productFormMapper.toCreatePayload(emptyOptionalValue, tiendaId)).toMatchObject({
      sku: undefined,
      codigoBarras: undefined,
      categoriaId: undefined,
      proveedor: null,
      paraQueSirve: null,
      recomendadoPara: null,
    })
    expect(productFormMapper.toUpdatePayload(emptyOptionalValue)).toMatchObject({
      sku: undefined,
      codigoBarras: undefined,
      categoriaId: undefined,
      proveedor: null,
      paraQueSirve: null,
      recomendadoPara: null,
    })
  })
})
