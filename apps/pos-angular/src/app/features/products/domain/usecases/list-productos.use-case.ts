import type { ProductRepository, SearchProductsParams } from '@angular-app/features/products/domain/repositories/product.repository'
import type { Product } from '@angular-app/features/products/domain/entities/product.entity'
import type { Result } from '@/shared/result'

export async function listProductos(
  repo: ProductRepository,
  params: Omit<SearchProductsParams, never>,
): Promise<Result<Product[]>> {
  return repo.search(params)
}
