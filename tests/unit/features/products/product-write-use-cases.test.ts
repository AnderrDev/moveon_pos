import { describe, expect, it } from 'vitest'
import { createProduct } from '@angular-app/features/products/domain/usecases/create-product.use-case'
import { updateProduct } from '@angular-app/features/products/domain/usecases/update-product.use-case'
import { deactivateProduct } from '@angular-app/features/products/domain/usecases/deactivate-product.use-case'
import { deleteProduct } from '@angular-app/features/products/domain/usecases/delete-product.use-case'
import { saveProductComponents } from '@angular-app/features/products/domain/usecases/save-product-components.use-case'
import { createCategoria } from '@angular-app/features/products/domain/usecases/create-categoria.use-case'
import { updateCategoria } from '@angular-app/features/products/domain/usecases/update-categoria.use-case'
import { deactivateCategoria } from '@angular-app/features/products/domain/usecases/deactivate-categoria.use-case'
import type { Product, Categoria } from '@angular-app/features/products/domain/entities/product.entity'

const tiendaId = '11111111-1111-4111-8111-111111111111'
const now = new Date('2026-07-17T00:00:00.000Z')

const product: Product = {
  id: 'product-1',
  tiendaId,
  nombre: 'Whey Protein',
  sku: null,
  codigoBarras: null,
  categoriaId: null,
  proveedor: null,
  paraQueSirve: null,
  recomendadoPara: null,
  imageUrl: null,
  tipo: 'simple',
  unidad: 'und',
  precioVenta: 100_000,
  costo: null,
  ivaTasa: 19,
  stockMinimo: 0,
  participaFidelizacion: false,
  isActive: true,
  deletedAt: null,
  createdAt: now,
  updatedAt: now,
}

const categoria: Categoria = {
  id: 'categoria-1',
  tiendaId,
  nombre: 'Proteínas',
  orden: 0,
  isActive: true,
  createdAt: now,
  updatedAt: now,
}

describe('createProduct', () => {
  const validInput = { tiendaId, nombre: 'Whey Protein', tipo: 'simple', precioVenta: 100_000, ivaTasa: 19 }

  it('crea el producto cuando los datos son válidos', async () => {
    const repo = { createProduct: async () => product }
    const result = await createProduct({ repo }, validInput, { cantidad: 0, ubicacion: 'bodega' })
    expect(result).toEqual({ ok: true, value: product })
  })

  it('rechaza nombre demasiado corto sin llamar al repositorio', async () => {
    let called = false
    const repo = { createProduct: async () => { called = true; return product } }
    const result = await createProduct({ repo }, { ...validInput, nombre: 'A' }, { cantidad: 0, ubicacion: 'bodega' })
    expect(result.ok).toBe(false)
    expect(called).toBe(false)
  })
})

describe('updateProduct', () => {
  it('actualiza el producto cuando los datos son válidos', async () => {
    const repo = { updateProduct: async () => product }
    const result = await updateProduct({ repo }, product.id, tiendaId, { nombre: 'Whey Protein 2kg' })
    expect(result).toEqual({ ok: true, value: product })
  })

  it('rechaza precio negativo sin llamar al repositorio', async () => {
    let called = false
    const repo = { updateProduct: async () => { called = true; return product } }
    const result = await updateProduct({ repo }, product.id, tiendaId, { precioVenta: -1 })
    expect(result.ok).toBe(false)
    expect(called).toBe(false)
  })
})

describe('deactivateProduct / deleteProduct', () => {
  it('delegan en el repositorio con los ids correctos', async () => {
    let deactivated: [string, string] | null = null
    let deleted: [string, string] | null = null
    await deactivateProduct({ repo: { deactivateProduct: async (id, tid) => { deactivated = [id, tid] } } }, product.id, tiendaId)
    await deleteProduct({ repo: { deleteProduct: async (id, tid) => { deleted = [id, tid] } } }, product.id, tiendaId)
    expect(deactivated).toEqual([product.id, tiendaId])
    expect(deleted).toEqual([product.id, tiendaId])
  })
})

describe('saveProductComponents', () => {
  it('delega la lista de componentes en el repositorio', async () => {
    let received: unknown = null
    const repo = {
      saveComponents: async (productId: string, tid: string, components: unknown) => {
        received = { productId, tid, components }
      },
    }
    const components = [{ componenteId: 'vaso-1', cantidad: 1 }]
    await saveProductComponents({ repo }, product.id, tiendaId, components)
    expect(received).toEqual({ productId: product.id, tid: tiendaId, components })
  })
})

describe('createCategoria / updateCategoria', () => {
  it('crea la categoría cuando el nombre es válido', async () => {
    const repo = { createCategoria: async () => categoria }
    const result = await createCategoria({ repo }, tiendaId, { nombre: 'Proteínas' })
    expect(result).toEqual({ ok: true, value: categoria })
  })

  it('rechaza nombre vacío sin llamar al repositorio', async () => {
    let called = false
    const repo = { createCategoria: async () => { called = true; return categoria } }
    const result = await createCategoria({ repo }, tiendaId, { nombre: '   ' })
    expect(result.ok).toBe(false)
    expect(called).toBe(false)
  })

  it('actualiza la categoría cuando el nombre es válido', async () => {
    const repo = { updateCategoria: async () => categoria }
    const result = await updateCategoria({ repo }, categoria.id, tiendaId, { nombre: 'Creatinas' })
    expect(result).toEqual({ ok: true, value: categoria })
  })

  it('rechaza actualización con nombre vacío sin llamar al repositorio', async () => {
    let called = false
    const repo = { updateCategoria: async () => { called = true; return categoria } }
    const result = await updateCategoria({ repo }, categoria.id, tiendaId, { nombre: '   ' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('validation')
    expect(called).toBe(false)
  })
})

describe('deactivateCategoria', () => {
  it('delega en el repositorio con los ids correctos', async () => {
    let received: [string, string] | null = null
    const repo = { deactivateCategoria: async (id: string, tid: string) => { received = [id, tid] } }
    await deactivateCategoria({ repo }, categoria.id, tiendaId)
    expect(received).toEqual([categoria.id, tiendaId])
  })
})
