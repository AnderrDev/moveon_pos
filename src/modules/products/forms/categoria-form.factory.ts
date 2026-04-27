import { z } from 'zod'

export const categoriaFormSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, 'El nombre es obligatorio')
    .max(80, 'El nombre no puede superar 80 caracteres'),
})

export type CategoriaFormValue = z.infer<typeof categoriaFormSchema>

export function createCategoriaFormDefaults(initial?: Partial<CategoriaFormValue>): CategoriaFormValue {
  const isDev = process.env.NODE_ENV === 'development'
  return { nombre: initial?.nombre ?? (isDev ? 'Proteínas' : '') }
}
