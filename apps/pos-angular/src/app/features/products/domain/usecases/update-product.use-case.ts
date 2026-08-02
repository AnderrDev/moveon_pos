import { err, ok, type Result } from '@/shared/result'
import type { Product } from '@angular-app/features/products/domain/entities/product.entity'
import { updateProductSchema } from '@angular-app/features/products/domain/dtos/product.dto'
import type { ProductRepository } from '@angular-app/features/products/domain/repositories/product.repository'
import type { TiendaId } from '@/shared/types'
import type { ProductValidationError } from '@angular-app/features/products/domain/usecases/create-product.use-case'

export interface UpdateProductDeps {
  repo: Pick<ProductRepository, 'updateProduct'>
}

/** Valida y actualiza un producto. Mismo contrato de errores que `createProduct`. */
export async function updateProduct(
  deps: UpdateProductDeps,
  id: string,
  tiendaId: TiendaId,
  input: unknown,
): Promise<Result<Product, ProductValidationError>> {
  const parsed = updateProductSchema.safeParse(input)
  if (!parsed.success) {
    return err({
      code: 'validation',
      message: parsed.error.issues[0]?.message ?? 'Datos del producto inválidos',
    })
  }
  const product = await deps.repo.updateProduct(id, tiendaId, parsed.data)
  return ok(product)
}
