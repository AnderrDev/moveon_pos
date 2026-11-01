import { describe, expect, it } from 'vitest'
import { createProduct } from '@angular-app/features/products/domain/usecases/create-product.use-case'
import { updateProduct } from '@angular-app/features/products/domain/usecases/update-product.use-case'
import { deactivateProduct } from '@angular-app/features/products/domain/usecases/deactivate-product.use-case'
import { deleteProduct } from '@angular-app/features/products/domain/usecases/delete-product.use-case'
import { saveProductComponents } from '@angular-app/features/products/domain/usecases/save-product-components.use-case'
import { createCategoria } from '@angular-app/features/products/domain/usecases/create-categoria.use-case'
import { updateCategoria } from '@angular-app/features/products/domain/usecases/update-categoria.use-case'
import { deactivateCategoria } from '@angular-app/features/products/domain/usecases/deactivate-categoria.use-case'
import { createProveedor } from '@angular-app/features/products/domain/usecases/create-proveedor.use-case'
import type { Product, Categoria, Proveedor } from '@angular-app/features/products/domain/entities/product.entity'

const tiendaId = '11111111-1111-4111-8111-111111111111'
const now = new Date('2026-07-17T00:00:00.000Z')

const product: Product = {
  id: 'product-1',
  tiendaId,
  nombre: 'Whey Protein',
  sku: null,
  codigoBarras: null,
  categoriaId: null,
  proveedorId: null,
  proveedorNombre: null,
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

const proveedor: Proveedor = {
  id: 'proveedor-1',
  tiendaId,
  nombre: 'Distribuidora Healthy',
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
  const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'

  it('delegan en el repositorio con los ids correctos', async () => {
    let deactivated: [string, string] | null = null
    let deleted: [string, string] | null = null
    const r1 = await deactivateProduct({ repo: { deactivateProduct: async (pid, tid) => { deactivated = [pid, tid] } } }, id, tiendaId)
    const r2 = await deleteProduct({ repo: { deleteProduct: async (pid, tid) => { deleted = [pid, tid] } } }, id, tiendaId)
    expect(r1.ok && r2.ok).toBe(true)
    expect(deactivated).toEqual([id, tiendaId])
    expect(deleted).toEqual([id, tiendaId])
  })

  it('rechazan ids inválidos sin llamar al repositorio', async () => {
    let called = false
    const r1 = await deactivateProduct({ repo: { deactivateProduct: async () => { called = true } } }, product.id, tiendaId)
    const r2 = await deleteProduct({ repo: { deleteProduct: async () => { called = true } } }, id, 'tienda-1')
    expect(r1.ok || r2.ok).toBe(false)
    expect(called).toBe(false)
  })
})

describe('saveProductComponents', () => {
  const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
  const vaso = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'

  it('delega la lista de componentes en el repositorio', async () => {
    let received: unknown = null
    const repo = {
      saveComponents: async (productId: string, tid: string, components: unknown) => {
        received = { productId, tid, components }
      },
    }
    const components = [{ componenteId: vaso, cantidad: 1 }]
    const result = await saveProductComponents({ repo }, id, tiendaId, components)
    expect(result).toEqual({ ok: true, value: undefined })
    expect(received).toEqual({ productId: id, tid: tiendaId, components })
  })

  it('rechaza cantidad cero o componentes repetidos sin llamar al repositorio', async () => {
    let called = false
    const repo = { saveComponents: async () => { called = true } }
    const zero = await saveProductComponents({ repo }, id, tiendaId, [{ componenteId: vaso, cantidad: 0 }])
    const dup = await saveProductComponents({ repo }, id, tiendaId, [
      { componenteId: vaso, cantidad: 1 },
      { componenteId: vaso, cantidad: 2 },
    ])
    expect(zero.ok).toBe(false)
    expect(!dup.ok && dup.error.message).toBe('Hay componentes repetidos')
    expect(called).toBe(false)
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
    const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
    let received: [string, string] | null = null
    const repo = { deactivateCategoria: async (cid: string, tid: string) => { received = [cid, tid] } }
    const result = await deactivateCategoria({ repo }, id, tiendaId)
    expect(result).toEqual({ ok: true, value: undefined })
    expect(received).toEqual([id, tiendaId])
  })

  it('rechaza ids inválidos sin llamar al repositorio', async () => {
    let called = false
    const repo = { deactivateCategoria: async () => { called = true } }
    const result = await deactivateCategoria({ repo }, categoria.id, tiendaId)
    expect(result.ok).toBe(false)
    expect(called).toBe(false)
  })
})

describe('createProveedor', () => {
  it('crea el proveedor cuando el nombre es válido', async () => {
    const repo = { createProveedor: async () => proveedor }
    const result = await createProveedor({ repo }, tiendaId, { nombre: 'Distribuidora Healthy' })
    expect(result).toEqual({ ok: true, value: proveedor })
  })

  it('rechaza nombre vacío sin llamar al repositorio', async () => {
    let called = false
    const repo = { createProveedor: async () => { called = true; return proveedor } }
    const result = await createProveedor({ repo }, tiendaId, { nombre: '   ' })
    expect(result.ok).toBe(false)
    expect(called).toBe(false)
  })
})
