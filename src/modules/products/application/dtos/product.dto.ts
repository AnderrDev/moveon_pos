import { z } from 'zod'
import { ivaRateSchema, productTypeSchema } from '@/shared/validations/common'

export const createProductSchema = z.object({
  tiendaId: z.string().uuid(),
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  sku: z.string().optional(),
  codigoBarras: z.string().optional(),
  categoriaId: z.string().uuid().optional(),
  tipo: productTypeSchema,
  unidad: z.string().default('und'),
  precioVenta: z.number().positive('El precio debe ser mayor a 0'),
  costo: z.number().nonnegative().optional(),
  ivaTasa: ivaRateSchema,
  stockMinimo: z.number().int().nonnegative().default(0),
  isActive: z.boolean().default(true),
})

export type CreateProductDto = z.infer<typeof createProductSchema>

export const updateProductSchema = createProductSchema.partial().omit({ tiendaId: true })
export type UpdateProductDto = z.infer<typeof updateProductSchema>

export const searchProductsSchema = z.object({
  query: z.string().optional(),
  categoriaId: z.string().uuid().optional(),
  soloActivos: z.boolean().default(true),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
})
export type SearchProductsDto = z.infer<typeof searchProductsSchema>

export const createCategoriaSchema = z.object({
  tiendaId: z.string().uuid(),
  nombre: z.string().min(1, 'El nombre es obligatorio'),
  orden: z.number().int().nonnegative().default(0),
})
export type CreateCategoriaDto = z.infer<typeof createCategoriaSchema>
