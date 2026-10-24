import { z } from 'zod'
import { err, ok, type Result } from '@/shared/result'
import type { ProductImageStorage } from '@angular-app/features/products/domain/repositories/product-image-storage.repository'
import type { ProductValidationError } from '@angular-app/features/products/domain/usecases/create-product.use-case'
import { validateProductImage } from '@angular-app/features/products/domain/services/product-image-rules'

export interface UploadProductImageDeps {
  storage: Pick<ProductImageStorage, 'upload'>
}

const tiendaIdSchema = z.string().uuid('Tienda inválida')

/**
 * Valida y sube la imagen de un producto; devuelve su URL pública. Los
 * rechazos de forma vuelven como `Result`; los fallos del almacenamiento se
 * propagan como `throw`.
 */
export async function uploadProductImage(
  deps: UploadProductImageDeps,
  file: File,
  tiendaId: string,
): Promise<Result<string, ProductValidationError>> {
  const tienda = tiendaIdSchema.safeParse(tiendaId)
  if (!tienda.success) {
    return err({ code: 'validation', message: tienda.error.issues[0]?.message ?? 'Tienda inválida' })
  }
  const problem = validateProductImage(file)
  if (problem) return err({ code: 'validation', message: problem })
  return ok(await deps.storage.upload(file, tienda.data))
}
