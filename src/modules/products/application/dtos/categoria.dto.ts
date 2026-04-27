import { z } from 'zod'

export const createCategoriaSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, 'El nombre es obligatorio')
    .max(80, 'El nombre no puede superar 80 caracteres'),
})
export type CreateCategoriaDto = z.infer<typeof createCategoriaSchema>

export const updateCategoriaSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, 'El nombre es obligatorio')
    .max(80, 'El nombre no puede superar 80 caracteres'),
})
export type UpdateCategoriaDto = z.infer<typeof updateCategoriaSchema>
