import { z } from 'zod'
import { salePriceSchema, skuSchema, ivaRateSchema, productTypeSchema } from '@/shared/validations/common'

// ── Constantes de validación ──────────────────────────────────────────────────

export const PRODUCT_NAME_MIN = 2
export const PRODUCT_NAME_MAX = 100
export const PRODUCT_SKU_MAX  = 50

// ── Schema del formulario ─────────────────────────────────────────────────────
// Distinto del DTO de la Server Action:
// - No incluye tiendaId (lo aporta el servidor desde el contexto de auth)
// - Mensajes orientados al usuario, no al sistema

export const productFormSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(PRODUCT_NAME_MIN, `El nombre debe tener al menos ${PRODUCT_NAME_MIN} caracteres`)
    .max(PRODUCT_NAME_MAX, `El nombre no puede superar ${PRODUCT_NAME_MAX} caracteres`),

  sku: skuSchema
    .optional()
    .or(z.literal('')),

  codigoBarras: z
    .string()
    .max(50)
    .optional()
    .or(z.literal('')),

  categoriaId: z
    .string()
    .uuid('Selecciona una categoría válida')
    .optional()
    .or(z.literal('')),

  tipo: productTypeSchema,

  unidad: z
    .string()
    .min(1, 'La unidad es obligatoria')
    .max(20)
    .default('und'),

  precioVenta: salePriceSchema,

  costo: z
    .number({ invalid_type_error: 'Ingresa un valor numérico' })
    .nonnegative('El costo no puede ser negativo')
    .optional(),

  ivaTasa: ivaRateSchema,

  stockMinimo: z
    .number({ invalid_type_error: 'Ingresa una cantidad válida' })
    .int('La cantidad debe ser un número entero')
    .nonnegative('El stock mínimo no puede ser negativo')
    .default(0),

  isActive: z.boolean().default(true),
})

// ── Tipos derivados (nunca se definen a mano) ─────────────────────────────────

export type ProductFormValue = z.infer<typeof productFormSchema>

// ── Función de valores por defecto ────────────────────────────────────────────

export function createProductFormDefaults(
  initial?: Partial<ProductFormValue>,
): ProductFormValue {
  const isDev = process.env.NODE_ENV === 'development'
  return {
    nombre:       initial?.nombre       ?? (isDev ? 'Whey Protein 1kg' : ''),
    sku:          initial?.sku          ?? (isDev ? 'WH001' : ''),
    codigoBarras: initial?.codigoBarras ?? '',
    categoriaId:  initial?.categoriaId  ?? '',
    tipo:         initial?.tipo         ?? 'simple',
    unidad:       initial?.unidad       ?? 'und',
    precioVenta:  initial?.precioVenta  ?? (isDev ? 110000 : 0),
    costo:        initial?.costo        ?? (isDev ? 70000 : undefined),
    ivaTasa:      initial?.ivaTasa      ?? (isDev ? 19 : 0),
    stockMinimo:  initial?.stockMinimo  ?? (isDev ? 2 : 0),
    isActive:     initial?.isActive     ?? true,
  }
}
