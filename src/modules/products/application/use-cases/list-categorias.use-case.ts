import type { CategoriaRepository } from '../../domain/repositories/product.repository'
import type { Categoria } from '../../domain/entities/product.entity'
import type { Result } from '@/shared/result'
import type { TiendaId } from '@/shared/types'

export async function listCategorias(
  repo: CategoriaRepository,
  tiendaId: TiendaId,
): Promise<Result<Categoria[]>> {
  return repo.findAll(tiendaId)
}
