import { z } from 'zod'

export const EMPLEADO_NAME_MIN = 2
export const EMPLEADO_NAME_MAX = 80

export const saveEmpleadoSchema = z.object({
  /** Ausente al crear; presente al editar. */
  id: z.string().uuid().optional(),
  tiendaId: z.string().uuid(),
  nombre: z
    .string()
    .trim()
    .min(EMPLEADO_NAME_MIN, `El nombre debe tener al menos ${EMPLEADO_NAME_MIN} caracteres`)
    .max(EMPLEADO_NAME_MAX),
  cargo: z.string().trim().max(60).optional(),
  salarioMensual: z
    .number()
    .int('El salario debe ser un valor entero en pesos')
    .nonnegative('El salario no puede ser negativo'),
  isActive: z.boolean().default(true),
})

export type SaveEmpleadoDto = z.infer<typeof saveEmpleadoSchema>
