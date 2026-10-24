import { z } from 'zod'
import { registerEntrySchema } from '@angular-app/features/inventory/domain/dtos/inventory.dto'

/**
 * Entrada de mercancía: reglas del DTO sin el producto (lo aporta el diálogo).
 * En pantalla el costo 0 significa "sin costo" y el motivo vacío "sin motivo".
 */
export const registerEntryFormSchema = registerEntrySchema.omit({ productId: true }).extend({
  ubicacion: registerEntrySchema.shape.ubicacion.removeDefault(),
  costoUnitario: z.number().nonnegative('El costo no puede ser negativo'),
  motivo: z.string().trim().max(200, 'El motivo no puede superar 200 caracteres'),
})

export type RegisterEntryFormValue = z.infer<typeof registerEntryFormSchema>

export function createRegisterEntryDefaults(initial: Partial<RegisterEntryFormValue> = {}): RegisterEntryFormValue {
  return {
    cantidad: initial.cantidad ?? 1,
    ubicacion: initial.ubicacion ?? 'bodega',
    costoUnitario: initial.costoUnitario ?? 0,
    motivo: initial.motivo ?? '',
  }
}
