import { z } from 'zod'
import { resolveCashHistoryPreset } from '../../domain/services/cash-history'
export const cashHistoryFormSchema = z.object({
  preset: z.enum(['today', 'yesterday', 'week', 'month', 'custom']),
  from: z.string().date(), to: z.string().date(),
  closedBy: z.string().uuid().or(z.literal('')),
  balanceStatus: z.enum(['all', 'balanced', 'difference']),
}).refine((value) => value.from <= value.to, { path: ['to'], message: 'La fecha final debe ser igual o posterior a la inicial' })
export type CashHistoryFormValue = z.infer<typeof cashHistoryFormSchema>
export function createCashHistoryFormDefaults(today: string): CashHistoryFormValue {
  return { preset: 'week', ...resolveCashHistoryPreset(today, 'week'), closedBy: '', balanceStatus: 'all' }
}
