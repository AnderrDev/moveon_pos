import { z } from 'zod'
import { EMPLEADO_NAME_MAX, EMPLEADO_NAME_MIN } from '../application/dtos/empleado.dto'

export const empleadoFormSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(EMPLEADO_NAME_MIN, `El nombre debe tener al menos ${EMPLEADO_NAME_MIN} caracteres`)
    .max(EMPLEADO_NAME_MAX),
  cargo: z.string().trim().max(60).optional().or(z.literal('')),
  salarioMensual: z
    .number()
    .int('El salario debe ser en pesos, sin decimales')
    .positive('Ingresa el salario mensual acordado'),
  isActive: z.boolean(),
})

export type EmpleadoFormValue = z.infer<typeof empleadoFormSchema>

export function createEmpleadoFormDefaults(
  initial: Partial<EmpleadoFormValue> = {},
): EmpleadoFormValue {
  return {
    nombre: initial.nombre ?? '',
    cargo: initial.cargo ?? '',
    salarioMensual: initial.salarioMensual ?? 0,
    isActive: initial.isActive ?? true,
  }
}
