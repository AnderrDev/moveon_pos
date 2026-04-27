import { z } from 'zod'

// ─── IDs ──────────────────────────────────────────────────────────────────────

export const uuidSchema = z.string().uuid('ID inválido')

export const tiendaIdSchema = z.string().uuid('ID de tienda inválido')

// ─── Enumeraciones del dominio ─────────────────────────────────────────────────

export const ivaRateSchema = z.union([z.literal(0), z.literal(5), z.literal(19)])

export const productTypeSchema = z.enum(['simple', 'prepared', 'ingredient'])

export const paymentMethodSchema = z.enum(['cash', 'card', 'nequi', 'daviplata', 'transfer', 'other'])

export const inventoryMovementTypeSchema = z.enum(['entry', 'sale_exit', 'adjustment', 'void_return'])

export const cashMovementTypeSchema = z.enum(['cash_in', 'cash_out', 'expense', 'correction'])

// ─── Paginación ───────────────────────────────────────────────────────────────

export const paginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
})

// ─── Dinero ───────────────────────────────────────────────────────────────────

/**
 * Pesos colombianos — entero sin centavos.
 * Rango: $0 a $100.000.000
 */
export const moneySchema = z
  .number({ invalid_type_error: 'Ingresa un valor numérico' })
  .int('El precio no puede tener centavos')
  .min(0, 'El valor no puede ser negativo')
  .max(100_000_000, 'El valor es demasiado alto')

/**
 * Precio de venta — debe ser positivo (mayor a $0).
 */
export const salePriceSchema = moneySchema.min(1, 'El precio de venta debe ser mayor a $0')

/**
 * Porcentaje (0–100).
 */
export const percentageSchema = z
  .number({ invalid_type_error: 'Ingresa un porcentaje' })
  .min(0, 'El porcentaje no puede ser negativo')
  .max(100, 'El porcentaje no puede superar 100')

// ─── Contacto Colombia ─────────────────────────────────────────────────────────

/**
 * Teléfono colombiano — 10 dígitos, con o sin +57.
 * Acepta: 3001234567, +573001234567
 */
export const phoneSchema = z
  .string()
  .regex(/^(\+57)?[0-9]{10}$/, 'Ingresa un teléfono colombiano válido (10 dígitos)')

/**
 * NIT colombiano — 9 a 10 dígitos (sin dígito verificador).
 */
export const nitSchema = z
  .string()
  .regex(/^[0-9]{9,10}$/, 'El NIT debe tener entre 9 y 10 dígitos')

/**
 * Cédula colombiana — 6 a 10 dígitos.
 */
export const cedulaSchema = z
  .string()
  .regex(/^[0-9]{6,10}$/, 'La cédula debe tener entre 6 y 10 dígitos')

// ─── Productos ─────────────────────────────────────────────────────────────────

/**
 * SKU — letras mayúsculas, números y guiones.
 * Ejemplos válidos: PRO-WHY-2KG, BAT-VAN-500ML
 */
export const skuSchema = z
  .string()
  .min(3, 'El SKU debe tener al menos 3 caracteres')
  .max(50, 'El SKU no puede tener más de 50 caracteres')
  .regex(
    /^[A-Z0-9-]+$/,
    'El SKU solo puede contener letras mayúsculas, números y guiones',
  )
  .transform((val) => val.toUpperCase())

/**
 * Cantidad de stock — entero positivo.
 */
export const stockQuantitySchema = z
  .number({ invalid_type_error: 'Ingresa una cantidad válida' })
  .int('La cantidad debe ser un número entero')
  .min(0, 'La cantidad no puede ser negativa')
  .max(99_999, 'Cantidad demasiado alta')

// ─── Texto general ─────────────────────────────────────────────────────────────

/**
 * Nombre de entidad — entre 2 y 100 caracteres.
 */
export const entityNameSchema = z
  .string()
  .min(2, 'El nombre debe tener al menos 2 caracteres')
  .max(100, 'El nombre no puede tener más de 100 caracteres')
  .trim()
