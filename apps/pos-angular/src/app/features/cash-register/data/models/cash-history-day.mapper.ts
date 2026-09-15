import { z } from 'zod'
import type { CashHistoryDay } from '../../domain/services/cash-history'
const amount = z.union([z.number(), z.string().min(1)]).pipe(z.coerce.number().finite())
export const cashHistoryDayRowSchema = z.object({
 day: z.string().date(), turn_count: z.number().int().nonnegative(),
 sales_total: amount.nullable(), cash_total: amount, transfer_total: amount,
 expenses_total: amount, extra_income_total: amount, withdrawals_total: amount,
 opening_amount: amount.nullable(), final_cash_left: amount.nullable(),
 notes: z.array(z.string()), total_days: z.coerce.number().int().nonnegative(),
})
export function rowToCashHistoryDay(value: unknown): CashHistoryDay {
 const row = cashHistoryDayRowSchema.parse(value)
 return { day: row.day, turnCount: row.turn_count, salesTotal: row.sales_total,
   cashTotal: row.cash_total, transferTotal: row.transfer_total, expensesTotal: row.expenses_total,
   extraIncomeTotal: row.extra_income_total, withdrawalsTotal: row.withdrawals_total,
   openingAmount: row.opening_amount, finalCashLeft: row.final_cash_left, notes: row.notes }
}
