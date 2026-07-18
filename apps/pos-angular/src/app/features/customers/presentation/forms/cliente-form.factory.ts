import { z } from 'zod'
import { isValidPhoneCO } from '@angular-app/features/customers/domain/value-objects/phone-co'

export const CLIENTE_NOMBRE_MIN = 2
export const CLIENTE_NOMBRE_MAX = 100

export const clienteFormSchema = z
  .object({
    nombre: z.string().trim().min(CLIENTE_NOMBRE_MIN, `El nombre debe tener al menos ${CLIENTE_NOMBRE_MIN} caracteres`).max(CLIENTE_NOMBRE_MAX),
    tipoDocumento: z.string(),
    numeroDocumento: z.string(),
    email: z.string().trim().email('Email inválido').optional().or(z.literal('')),
    telefono: z.string(),
    autorizaFidelizacion: z.boolean().default(false),
    aceptaMensajesPromocionales: z.boolean().default(false),
  })
  .superRefine((value, ctx) => {
    // RN-CL04/RN-CL06: para participar en MOVE ON Club se necesita un
    // celular colombiano válido — el programa identifica al cliente por él.
    if (value.autorizaFidelizacion && !isValidPhoneCO(value.telefono.trim())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['telefono'],
        message: 'Para participar en MOVE ON Club se necesita un celular colombiano válido (10 dígitos)',
      })
    }
  })

export type ClienteFormValue = z.infer<typeof clienteFormSchema>

export function createClienteFormDefaults(
  initial: Partial<ClienteFormValue> = {},
): ClienteFormValue {
  return {
    nombre: initial.nombre ?? '',
    tipoDocumento: initial.tipoDocumento ?? '',
    numeroDocumento: initial.numeroDocumento ?? '',
    email: initial.email ?? '',
    telefono: initial.telefono ?? '',
    autorizaFidelizacion: initial.autorizaFidelizacion ?? false,
    aceptaMensajesPromocionales: initial.aceptaMensajesPromocionales ?? false,
  }
}
