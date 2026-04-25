import { z } from 'zod'

export const uuidSchema = z.string().uuid()

export const tiendaIdSchema = z.string().uuid()

export const ivaRateSchema = z.union([z.literal(0), z.literal(5), z.literal(19)])

export const productTypeSchema = z.enum(['simple', 'prepared', 'ingredient'])

export const paymentMethodSchema = z.enum(['cash', 'card', 'transfer', 'other'])

export const paginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
})
