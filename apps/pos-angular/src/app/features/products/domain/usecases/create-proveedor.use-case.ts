import { err, ok, type Result } from '@/shared/result'
import type { Proveedor } from '@angular-app/features/products/domain/entities/product.entity'
import { createProveedorSchema } from '@angular-app/features/products/domain/dtos/proveedor.dto'
import type { ProductRepository } from '@angular-app/features/products/domain/repositories/product.repository'
import type { TiendaId } from '@/shared/types'
import type { ProductValidationError } from '@angular-app/features/products/domain/usecases/create-product.use-case'

export interface CreateProveedorDeps {
  repo: Pick<ProductRepository, 'createProveedor'>
}

/** Valida y crea un proveedor. Mismo contrato de errores que `createProduct`. */
export async function createProveedor(
  deps: CreateProveedorDeps,
  tiendaId: TiendaId,
  input: unknown,
): Promise<Result<Proveedor, ProductValidationError>> {
  const parsed = createProveedorSchema.safeParse(input)
  if (!parsed.success) {
    return err({
      code: 'validation',
      message: parsed.error.issues[0]?.message ?? 'Datos del proveedor inválidos',
    })
  }
  const proveedor = await deps.repo.createProveedor(parsed.data, tiendaId)
  return ok(proveedor)
}
