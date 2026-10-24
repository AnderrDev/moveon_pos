import { z } from 'zod'
import {
  ENTRY_CASH_PAYMENT_NEEDS_COST,
  entryCashPaymentHasCost,
  entryPaymentMethodSchema,
  registerEntryFieldsSchema,
} from '@angular-app/features/inventory/domain/dtos/inventory.dto'

/**
 * Entrada de mercancía: reglas del DTO sin el producto (lo aporta el diálogo).
 * En pantalla el costo 0 significa "sin costo", el motivo vacío "sin motivo"
 * y el método de pago vacío "pago no registrado".
 */
export const registerEntryFormSchema = registerEntryFieldsSchema
  .omit({ productId: true })
  .extend({
    ubicacion: registerEntryFieldsSchema.shape.ubicacion.removeDefault(),
    costoUnitario: z.number().nonnegative('El costo no puede ser negativo'),
    motivo: z.string().trim().max(200, 'El motivo no puede superar 200 caracteres'),
    metodoPago: z.union([entryPaymentMethodSchema, z.literal('')]),
  })
  .refine(entryCashPaymentHasCost, { message: ENTRY_CASH_PAYMENT_NEEDS_COST, path: ['costoUnitario'] })

export type RegisterEntryFormValue = z.infer<typeof registerEntryFormSchema>

export function createRegisterEntryDefaults(initial: Partial<RegisterEntryFormValue> = {}): RegisterEntryFormValue {
  return {
    cantidad: initial.cantidad ?? 1,
    ubicacion: initial.ubicacion ?? 'bodega',
    costoUnitario: initial.costoUnitario ?? 0,
    motivo: initial.motivo ?? '',
    metodoPago: initial.metodoPago ?? '',
  }
}
