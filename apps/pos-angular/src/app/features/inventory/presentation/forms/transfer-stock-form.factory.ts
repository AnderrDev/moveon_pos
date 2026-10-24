import { z } from 'zod'
import {
  TRANSFER_LOCATIONS_ERROR,
  transferLocationsDiffer,
  transferStockFieldsSchema,
} from '@angular-app/features/inventory/domain/dtos/inventory.dto'

/** Traslado: reglas del DTO (incluida origen ≠ destino) sin el producto. */
export const transferStockFormSchema = transferStockFieldsSchema
  .omit({ productId: true })
  .extend({ motivo: z.string().trim().pipe(transferStockFieldsSchema.shape.motivo) })
  .refine(transferLocationsDiffer, TRANSFER_LOCATIONS_ERROR)

export type TransferStockFormValue = z.infer<typeof transferStockFormSchema>

export function createTransferStockDefaults(initial: Partial<TransferStockFormValue> = {}): TransferStockFormValue {
  return {
    fromUbicacion: initial.fromUbicacion ?? 'bodega',
    toUbicacion: initial.toUbicacion ?? 'punto_venta',
    cantidad: initial.cantidad ?? 1,
    motivo: initial.motivo ?? '',
  }
}
