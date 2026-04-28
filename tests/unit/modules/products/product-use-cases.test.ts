import { describe, expect, it } from 'vitest'
import { listCategorias } from '@/modules/products/application/use-cases/list-categorias.use-case'
import { listProductos } from '@/modules/products/application/use-cases/list-productos.use-case'
import type { Categoria, Product } from '@/modules/products/domain/entities/product.entity'
import type { CategoriaRepository, ProductRepository } from '@/modules/products/domain/repositories/product.repository'
import { err, ok } from '@/shared/result'

const tiendaId = 'tienda-1'
const now = new Date('2026-04-27T12:00:00.000Z')

const product: Product = {
  id:           'product-1',
  tiendaId,
  nombre:       'Proteina',
  sku:          'PRO-1',
  codigoBarras: null,
  categoriaId:  null,
  tipo:         'simple',
  unidad:       'unidad',
  precioVenta:  100_000,
  costo:        50_000,
  ivaTasa:      19,
  stockMinimo:  1,
  isActive:     true,
  createdAt:    now,
  updatedAt:    now,
}

const categoria: Categoria = {
  id:        'categoria-1',
  tiendaId,
  nombre:    'Proteinas',
  orden:     1,
  isActive:  true,
  createdAt: now,
  updatedAt: now,
}

describe('product use-cases', () => {
  it('lista productos delegando filtros al repositorio', async () => {
    const repo: ProductRepository = {
      findById:      async () => ok(null),
      findByBarcode: async () => ok(null),
      search:        async (params) => {
        expect(params).toEqual({ tiendaId, query: 'pro', soloActivos: true })
        return ok([product])
      },
      create:     async () => err(new Error('not implemented')),
      update:     async () => err(new Error('not implemented')),
      deactivate: async () => err(new Error('not implemented')),
    }

    const result = await listProductos(repo, { tiendaId, query: 'pro', soloActivos: true })

    expect(result).toEqual(ok([product]))
  })

  it('lista categorias de la tienda indicada', async () => {
    const repo: CategoriaRepository = {
      findAll: async (receivedTiendaId) => {
        expect(receivedTiendaId).toBe(tiendaId)
        return ok([categoria])
      },
      findById:   async () => ok(null),
      create:     async () => err(new Error('not implemented')),
      update:     async () => err(new Error('not implemented')),
      deactivate: async () => err(new Error('not implemented')),
    }

    const result = await listCategorias(repo, tiendaId)

    expect(result).toEqual(ok([categoria]))
  })
})
