import { z } from 'zod'
import { ivaRateSchema, productTypeSchema } from '@/shared/validations/common'

export const createProductSchema = z.object({
  tiendaId: z.string().uuid(),
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  sku: z.string().optional(),
  codigoBarras: z.string().optional(),
  categoriaId: z.string().uuid().optional(),
  proveedor: z
    .string()
    .trim()
    .max(100, 'El proveedor no puede superar 100 caracteres')
    .nullable()
    .optional(),
  paraQueSirve: z
    .string()
    .trim()
    .max(800, 'La información no puede superar 800 caracteres')
    .nullable()
    .optional(),
  recomendadoPara: z
    .string()
    .trim()
    .max(800, 'La recomendación no puede superar 800 caracteres')
    .nullable()
    .optional(),
  imageUrl: z
    .string()
    .trim()
    .url('La URL de imagen no es válida')
    .max(1000, 'La URL de imagen es demasiado larga')
    .nullable()
    .optional(),
  tipo: productTypeSchema,
  unidad: z.string().default('und'),
  precioVenta: z.number().nonnegative('El precio no puede ser negativo'),
  costo: z.number().nonnegative().optional(),
  ivaTasa: ivaRateSchema,
  stockMinimo: z.number().int().nonnegative().default(0),
  participaFidelizacion: z.boolean().default(false),
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
