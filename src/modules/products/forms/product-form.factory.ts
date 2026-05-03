import { z } from 'zod'
import { salePriceSchema, skuSchema, ivaRateSchema, productTypeSchema } from '@/shared/validations/common'

// ── Constantes de validación ──────────────────────────────────────────────────

export const PRODUCT_NAME_MIN = 2
export const PRODUCT_NAME_MAX = 100
export const PRODUCT_SKU_MAX  = 50

// ── Schema del formulario ─────────────────────────────────────────────────────
// Distinto del DTO del backend:
// - No incluye tiendaId (lo aporta el presenter desde el contexto de auth)
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
// El presenter Angular puede pasar overrides cuando necesite seed local;
// el factory en sí mismo nunca filtra credenciales o datos hardcodeados al bundle.

export function createProductFormDefaults(
  initial: Partial<ProductFormValue> = {},
): ProductFormValue {
  return {
    nombre:       initial.nombre       ?? '',
    sku:          initial.sku          ?? '',
    codigoBarras: initial.codigoBarras ?? '',
    categoriaId:  initial.categoriaId  ?? '',
    tipo:         initial.tipo         ?? 'simple',
    unidad:       initial.unidad       ?? 'und',
    precioVenta:  initial.precioVenta  ?? 0,
    costo:        initial.costo,
    ivaTasa:      initial.ivaTasa      ?? 0,
    stockMinimo:  initial.stockMinimo  ?? 0,
    isActive:     initial.isActive     ?? true,
  }
}
