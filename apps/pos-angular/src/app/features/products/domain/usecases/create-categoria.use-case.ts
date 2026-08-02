import { err, ok, type Result } from '@/shared/result'
import type { Categoria } from '@angular-app/features/products/domain/entities/product.entity'
import { createCategoriaSchema } from '@angular-app/features/products/domain/dtos/categoria.dto'
import type { ProductRepository } from '@angular-app/features/products/domain/repositories/product.repository'
import type { TiendaId } from '@/shared/types'
import type { ProductValidationError } from '@angular-app/features/products/domain/usecases/create-product.use-case'

export interface CreateCategoriaDeps {
  repo: Pick<ProductRepository, 'createCategoria'>
}

/** Valida y crea una categoría. Mismo contrato de errores que `createProduct`. */
export async function createCategoria(
  deps: CreateCategoriaDeps,
  tiendaId: TiendaId,
  input: unknown,
): Promise<Result<Categoria, ProductValidationError>> {
  const parsed = createCategoriaSchema.safeParse(input)
  if (!parsed.success) {
    return err({
      code: 'validation',
      message: parsed.error.issues[0]?.message ?? 'Datos de la categoría inválidos',
    })
  }
  const categoria = await deps.repo.createCategoria(parsed.data, tiendaId)
  return ok(categoria)
}
