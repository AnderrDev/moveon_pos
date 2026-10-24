import { z } from 'zod'
import { adjustStockSchema } from '@angular-app/features/inventory/domain/dtos/inventory.dto'

/** Ajuste de stock: reglas del DTO sin el producto; el motivo se recorta antes de validarlo. */
export const adjustStockFormSchema = adjustStockSchema.omit({ productId: true }).extend({
  motivo: z.string().trim().pipe(adjustStockSchema.shape.motivo),
})

export type AdjustStockFormValue = z.infer<typeof adjustStockFormSchema>

export function createAdjustStockDefaults(initial: Partial<AdjustStockFormValue> = {}): AdjustStockFormValue {
  return {
    cantidadDelta: initial.cantidadDelta ?? 0,
    ubicacion: initial.ubicacion ?? 'punto_venta',
    motivo: initial.motivo ?? '',
  }
}
