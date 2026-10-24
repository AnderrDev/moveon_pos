import { z } from 'zod'

/**
 * Ajuste manual de sellos MOVE ON Club (RN-LF16). Fuente única de las reglas:
 * el formulario (`adjust-stamps-form.factory.ts`) compone estos mismos campos
 * y el RPC `adjust_loyalty_stamps` re-valida en servidor.
 */
export const stampsDeltaSchema = z
  .number({ invalid_type_error: 'Ingresa cuántos sellos sumar o restar' })
  .int('Debe ser un número entero')
  .min(-99, 'Máximo 99 sellos por ajuste')
  .max(99, 'Máximo 99 sellos por ajuste')
  .refine((value) => value !== 0, 'El ajuste debe ser distinto de cero')

export const stampsReasonSchema = z
  .string()
  .trim()
  .min(3, 'El motivo es obligatorio (mínimo 3 caracteres)')
  .max(200, 'Máximo 200 caracteres')

export const adjustStampsSchema = z.object({
  tiendaId: z.string().uuid('Tienda inválida'),
  clienteId: z.string().uuid('Cliente inválido'),
  createdBy: z.string().uuid('Usuario inválido'),
  delta: stampsDeltaSchema,
  reason: stampsReasonSchema,
})
