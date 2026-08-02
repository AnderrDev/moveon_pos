import { z } from 'zod'
import type {
  ProductOption,
  ProductRepository,
} from '@angular-app/features/products/domain/repositories/product.repository'
import { err, ok, type Result } from '@/shared/result'
import type { TiendaId } from '@/shared/types'

export interface SaveProductOptionsDeps {
  repo: Pick<ProductRepository, 'saveOptions'>
}

export interface SaveProductOptionsError {
  message: string
}

const optionSchema = z.object({
  id: z.string().uuid().optional(),
  grupo: z.string().trim().min(1, 'El grupo de opciones no puede ir vacío'),
  nombre: z.string().trim().min(1, 'La opción necesita un nombre'),
  precioExtra: z.number().nonnegative('El recargo no puede ser negativo'),
  componenteId: z.string().uuid().nullable(),
  componenteNombre: z.string(),
  componenteCantidad: z.number().nonnegative('La cantidad no puede ser negativa'),
  esDefault: z.boolean(),
})

const optionsSchema = z
  .array(optionSchema)
  .superRefine((options, ctx) => {
    const names = options.map((option) => `${option.grupo}::${option.nombre.toLowerCase()}`)
    if (new Set(names).size !== names.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Hay opciones con el mismo nombre' })
    }
    // El POS necesita saber qué preseleccionar; sin default preselecciona la
    // primera, pero el RPC también usa el default cuando la venta no manda
    // opción — dejar más de uno haría ambiguo cuál gana (ADR 0017 §2.3).
    if (options.filter((option) => option.esDefault).length > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Solo una opción puede ser la predeterminada',
      })
    }
    for (const option of options) {
      if (option.componenteId && option.componenteCantidad <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Indica cuánto consume la opción "${option.nombre}"`,
        })
      }
    }
  })

/**
 * Reemplaza las opciones de venta de un producto preparado (ADR 0017). Valida
 * forma y coherencia del conjunto antes de tocar la base; el repositorio se
 * encarga de preservar las filas que las ventas pasadas referencian.
 */
export async function saveProductOptions(
  deps: SaveProductOptionsDeps,
  productId: string,
  tiendaId: TiendaId,
  options: ProductOption[],
): Promise<Result<ProductOption[], SaveProductOptionsError>> {
  const parsed = optionsSchema.safeParse(options)
  if (!parsed.success) {
    return err({ message: parsed.error.issues[0]?.message ?? 'Opciones inválidas' })
  }

  await deps.repo.saveOptions(productId, tiendaId, parsed.data)
  return ok(parsed.data)
}
