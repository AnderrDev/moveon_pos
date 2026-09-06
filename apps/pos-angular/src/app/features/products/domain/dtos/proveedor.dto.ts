import { z } from 'zod'

export const createProveedorSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, 'El nombre es obligatorio')
    .max(100, 'El nombre no puede superar 100 caracteres'),
})
export type CreateProveedorDto = z.infer<typeof createProveedorSchema>
