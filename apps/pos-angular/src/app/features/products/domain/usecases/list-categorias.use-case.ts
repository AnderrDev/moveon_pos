import type { CategoriaRepository } from '@angular-app/features/products/domain/repositories/product.repository'
import type { Categoria } from '@angular-app/features/products/domain/entities/product.entity'
import type { Result } from '@/shared/result'
import type { TiendaId } from '@/shared/types'

export async function listCategorias(
  repo: CategoriaRepository,
  tiendaId: TiendaId,
): Promise<Result<Categoria[]>> {
  return repo.findAll(tiendaId)
}
