import type { Result } from '@/shared/result'
import type { Product, Categoria } from '../entities/product.entity'
import type { TiendaId } from '@/shared/types'

export interface SearchProductsParams {
  tiendaId: TiendaId
  query?: string
  categoriaId?: string
  soloActivos?: boolean
  page?: number
  limit?: number
}

export interface ProductRepository {
  findById(id: string, tiendaId: TiendaId): Promise<Result<Product | null>>
  findByBarcode(codigoBarras: string, tiendaId: TiendaId): Promise<Result<Product | null>>
  search(params: SearchProductsParams): Promise<Result<Product[]>>
  create(product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Result<Product>>
  update(id: string, tiendaId: TiendaId, data: Partial<Product>): Promise<Result<Product>>
  deactivate(id: string, tiendaId: TiendaId): Promise<Result<void>>
}

export interface CategoriaRepository {
  findAll(tiendaId: TiendaId): Promise<Result<Categoria[]>>
  findById(id: string, tiendaId: TiendaId): Promise<Result<Categoria | null>>
  create(data: Omit<Categoria, 'id' | 'createdAt' | 'updatedAt'>): Promise<Result<Categoria>>
  update(id: string, tiendaId: TiendaId, data: Partial<Categoria>): Promise<Result<Categoria>>
  deactivate(id: string, tiendaId: TiendaId): Promise<Result<void>>
}
