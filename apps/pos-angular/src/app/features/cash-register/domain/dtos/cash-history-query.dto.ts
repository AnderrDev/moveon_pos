import { z } from 'zod'
export const cashHistoryQuerySchema = z.object({
 tiendaId: z.string().uuid(), start: z.date(), endExclusive: z.date(),
 closedBy: z.string().uuid().nullable(), balanceStatus: z.enum(['all','balanced','difference']),
 page: z.number().int().min(1), pageSize: z.number().int().min(1).max(100),
}).refine((value) => value.start < value.endExclusive, { message: 'Rango de fechas inválido' })
