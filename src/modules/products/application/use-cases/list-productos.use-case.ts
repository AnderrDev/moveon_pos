import type { ProductRepository, SearchProductsParams } from '../../domain/repositories/product.repository'
import type { Product } from '../../domain/entities/product.entity'
import type { Result } from '@/shared/result'

export async function listProductos(
  repo: ProductRepository,
  params: Omit<SearchProductsParams, never>,
): Promise<Result<Product[]>> {
  return repo.search(params)
}
