import { z } from 'zod'

// ─── Enumeraciones del dominio ─────────────────────────────────────────────────

export const ivaRateSchema = z.union([z.literal(0), z.literal(5), z.literal(19)])

export const productTypeSchema = z.enum(['simple', 'prepared', 'ingredient'])

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
 * Precio de venta — puede ser $0 (ej. ingredientes internos sin precio de venta directo).
 */
export const salePriceSchema = moneySchema.min(0, 'El precio de venta no puede ser negativo')

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
