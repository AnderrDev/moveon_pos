import { err, ok, type Result } from '@/shared/result'
import type { Categoria } from '@angular-app/features/products/domain/entities/product.entity'
import { updateCategoriaSchema } from '@angular-app/features/products/domain/dtos/categoria.dto'
import type { ProductRepository } from '@angular-app/features/products/domain/repositories/product.repository'
import type { TiendaId } from '@/shared/types'
import type { ProductValidationError } from '@angular-app/features/products/domain/usecases/create-product.use-case'

export interface UpdateCategoriaDeps {
  repo: Pick<ProductRepository, 'updateCategoria'>
}

/** Valida y actualiza una categoría. Mismo contrato de errores que `createProduct`. */
export async function updateCategoria(
  deps: UpdateCategoriaDeps,
  id: string,
  tiendaId: TiendaId,
  input: unknown,
): Promise<Result<Categoria, ProductValidationError>> {
  const parsed = updateCategoriaSchema.safeParse(input)
  if (!parsed.success) {
    return err({
      code: 'validation',
      message: parsed.error.issues[0]?.message ?? 'Datos de la categoría inválidos',
    })
  }
  const categoria = await deps.repo.updateCategoria(id, tiendaId, parsed.data)
  return ok(categoria)
}
