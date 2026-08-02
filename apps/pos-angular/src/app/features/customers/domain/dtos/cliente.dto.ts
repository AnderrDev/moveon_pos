import { z } from 'zod'
import { isValidPhoneCO } from '@angular-app/features/customers/domain/value-objects/phone-co'

export const CLIENTE_NOMBRE_MIN = 2
export const CLIENTE_NOMBRE_MAX = 100

/**
 * Valida el payload de escritura de cliente (RN-CL04/RN-CL06: celular
 * colombiano válido obligatorio si autoriza fidelización). Distinto del
 * schema de formulario (`presentation/forms/cliente-form.factory.ts`): este
 * es el contrato de borde que valida el use-case antes de escribir, sin
 * confiar solo en que el presenter ya validó.
 */
export const clienteInputSchema = z
  .object({
    nombre: z.string().trim().min(CLIENTE_NOMBRE_MIN, `El nombre debe tener al menos ${CLIENTE_NOMBRE_MIN} caracteres`).max(CLIENTE_NOMBRE_MAX),
    tipoDocumento: z.string().optional(),
    numeroDocumento: z.string().optional(),
    email: z.string().trim().email('Email inválido').optional(),
    telefono: z.string().optional(),
    autorizaFidelizacion: z.boolean().optional(),
    aceptaMensajesPromocionales: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.autorizaFidelizacion && !isValidPhoneCO((value.telefono ?? '').trim())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['telefono'],
        message: 'Para participar en MOVE ON Club se necesita un celular colombiano válido (10 dígitos)',
      })
    }
  })

