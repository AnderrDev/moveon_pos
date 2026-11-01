import { z } from 'zod'
import { splitProductSchema } from '@angular-app/features/inventory/domain/dtos/inventory.dto'

/**
 * Fraccionar: reglas del DTO sin el origen (lo pone el diálogo). `destinoId`
 * es siempre string ('' = sin elegir) para que el control de Angular no quede
 * opcional; la nota se recorta antes de validar.
 */
export const splitProductFormSchema = z
  .object({
    cantidadOrigen: z.number({ invalid_type_error: 'Indica cuántas unidades abres' }).positive('Indica cuántas unidades abres'),
    destinoId: z.string().uuid('Selecciona el producto que sale'),
    cantidadDestino: z
      .number({ invalid_type_error: 'Indica cuántas porciones salen' })
      .int('Las porciones deben ser un número entero')
      .positive('Indica cuántas porciones salen'),
    ubicacion: splitProductSchema.innerType().shape.ubicacion,
    nota: z.string().trim().max(200, 'La nota no puede pasar de 200 caracteres'),
  })

export type SplitProductFormValue = z.infer<typeof splitProductFormSchema>

export function createSplitProductDefaults(initial: Partial<SplitProductFormValue> = {}): SplitProductFormValue {
  return {
    cantidadOrigen: initial.cantidadOrigen ?? 1,
    destinoId: initial.destinoId ?? '',
    cantidadDestino: initial.cantidadDestino ?? 0,
    ubicacion: initial.ubicacion ?? 'punto_venta',
    nota: initial.nota ?? '',
  }
}
