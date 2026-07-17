import { z } from 'zod'
import { salePriceSchema, skuSchema, ivaRateSchema, productTypeSchema } from '@/shared/validations/common'
import { inventoryLocationSchema } from '@/modules/inventory/application/dtos/inventory.dto'

// ── Constantes de validación ──────────────────────────────────────────────────

export const PRODUCT_NAME_MIN = 2
export const PRODUCT_NAME_MAX = 100
export const PRODUCT_SKU_MAX  = 50
export const PRODUCT_INFO_MAX = 800
export const PRODUCT_PROVEEDOR_MAX = 100

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

  proveedor: z
    .string()
    .trim()
    .max(PRODUCT_PROVEEDOR_MAX, `El proveedor no puede superar ${PRODUCT_PROVEEDOR_MAX} caracteres`)
    .optional()
    .or(z.literal('')),

  paraQueSirve: z
    .string()
    .trim()
    .max(PRODUCT_INFO_MAX, `La información no puede superar ${PRODUCT_INFO_MAX} caracteres`)
    .optional()
    .or(z.literal('')),

  recomendadoPara: z
    .string()
    .trim()
    .max(PRODUCT_INFO_MAX, `La recomendación no puede superar ${PRODUCT_INFO_MAX} caracteres`)
    .optional()
    .or(z.literal('')),

  // URL pública de la imagen del producto. La UI de subida escribe aquí la URL
  // devuelta por Supabase Storage; '' representa "sin imagen".
  imageUrl: z
    .string()
    .trim()
    .url('La URL de imagen no es válida')
    .max(1000, 'La URL de imagen es demasiado larga')
    .optional()
    .or(z.literal('')),

  tipo: productTypeSchema,

  unidad: z
    .string()
    .min(1, 'La unidad es obligatoria')
    .max(20)
    .default('und'),

  precioVenta: salePriceSchema,

  // El costo es opcional: el select/input puede entregar '' | null | undefined | NaN.
  // El preprocess los normaliza a undefined, pero NO toca el 0 (costo válido).
  costo: z.preprocess(
    (v) =>
      v === '' || v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v))
        ? undefined
        : v,
    z
      .number({ invalid_type_error: 'Ingresa un valor numérico' })
      .nonnegative('El costo no puede ser negativo')
      .optional(),
  ),

  ivaTasa: ivaRateSchema,

  stockMinimo: z
    .number({ invalid_type_error: 'Ingresa una cantidad válida' })
    .int('La cantidad debe ser un número entero')
    .nonnegative('El stock mínimo no puede ser negativo')
    .default(0),

  stockInicial: z.preprocess(
    (value) =>
      value === '' || value === null || value === undefined ||
      (typeof value === 'number' && Number.isNaN(value))
        ? 0
        : value,
    z
      .number({ invalid_type_error: 'Ingresa una cantidad válida' })
      .nonnegative('El inventario inicial no puede ser negativo'),
  ),

  stockInicialUbicacion: inventoryLocationSchema.default('bodega'),

  participaFidelizacion: z.boolean().default(false),

  isActive: z.boolean().default(true),
}).superRefine((value, ctx) => {
  if (value.tipo === 'prepared' && value.stockInicial > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['stockInicial'],
      message: 'Los productos preparados no controlan inventario',
    })
  }
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
    proveedor:    initial.proveedor    ?? '',
    paraQueSirve: initial.paraQueSirve ?? '',
    recomendadoPara: initial.recomendadoPara ?? '',
    imageUrl:     initial.imageUrl     ?? '',
    tipo:         initial.tipo         ?? 'simple',
    unidad:       initial.unidad       ?? 'und',
    precioVenta:  initial.precioVenta  ?? 0,
    costo:        initial.costo,
    ivaTasa:      initial.ivaTasa      ?? 0,
    stockMinimo:  initial.stockMinimo  ?? 0,
    stockInicial: initial.stockInicial ?? 0,
    stockInicialUbicacion: initial.stockInicialUbicacion ?? 'bodega',
    participaFidelizacion: initial.participaFidelizacion ?? false,
    isActive:     initial.isActive     ?? true,
  }
}
