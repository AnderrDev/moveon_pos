import { z } from 'zod'
import { err, ok, type Result } from '@/shared/result'
import { entityRefSchema } from '@/shared/validations/common'
import type { ProductRepository } from '@angular-app/features/products/domain/repositories/product.repository'
import type { ProductValidationError } from '@angular-app/features/products/domain/usecases/create-product.use-case'
import type { TiendaId } from '@/shared/types'

export interface SaveProductComponentsDeps {
  repo: Pick<ProductRepository, 'saveComponents'>
}

const componentsSchema = z
  .array(
    z.object({
      componenteId: z.string().uuid('Componente inválido'),
      cantidad: z.number().positive('La cantidad de cada componente debe ser mayor a 0'),
    }),
  )
  .refine(
    (components) => new Set(components.map((c) => c.componenteId)).size === components.length,
    'Hay componentes repetidos',
  )

/**
 * Reemplaza los componentes de un `prepared` (ingredientes de un batido) o
 * los productos incluidos de un `combo`. Valida con Zod y devuelve `Result`;
 * `save_product_components_atomic` re-valida en servidor (tienda, tipos,
 * autorreferencia) y los fallos técnicos se propagan como `throw`.
 */
export async function saveProductComponents(
  deps: SaveProductComponentsDeps,
  productId: string,
  tiendaId: TiendaId,
  components: { componenteId: string; cantidad: number }[],
): Promise<Result<void, ProductValidationError>> {
  const ref = entityRefSchema.safeParse({ id: productId, tiendaId })
  if (!ref.success) {
    return err({ code: 'validation', message: ref.error.issues[0]?.message ?? 'Producto inválido' })
  }
  const parsed = componentsSchema.safeParse(components)
  if (!parsed.success) {
    return err({ code: 'validation', message: parsed.error.issues[0]?.message ?? 'Componentes inválidos' })
  }
  await deps.repo.saveComponents(ref.data.id, ref.data.tiendaId, parsed.data)
  return ok(undefined)
}
