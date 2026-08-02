import { err, ok, type Result } from '@/shared/result'
import type { Product } from '@angular-app/features/products/domain/entities/product.entity'
import { createProductSchema } from '@angular-app/features/products/domain/dtos/product.dto'
import type { InitialStockInput, ProductRepository } from '@angular-app/features/products/domain/repositories/product.repository'

export interface CreateProductDeps {
  repo: Pick<ProductRepository, 'createProduct'>
}

export interface ProductValidationError {
  code: 'validation'
  message: string
}

/**
 * Valida y crea un producto. Errores de dominio como `Result`; los fallos
 * técnicos del repositorio se propagan como `throw` (mismo patrón que
 * registerExpense/createCustomer).
 */
export async function createProduct(
  deps: CreateProductDeps,
  input: unknown,
  initialStock: InitialStockInput,
): Promise<Result<Product, ProductValidationError>> {
  const parsed = createProductSchema.safeParse(input)
  if (!parsed.success) {
    return err({
      code: 'validation',
      message: parsed.error.issues[0]?.message ?? 'Datos del producto inválidos',
    })
  }
  const product = await deps.repo.createProduct(parsed.data, initialStock)
  return ok(product)
}
