import { expect, it } from 'vitest'
import { rowToCashHistoryDay } from '@angular-app/features/cash-register/data/models/cash-history-day.mapper'
import { cashHistoryQuerySchema } from '@angular-app/features/cash-register/domain/dtos/cash-history-query.dto'
const row = { day: '2026-09-13', turn_count: 2, sales_total: '50000', cash_total: '25000', transfer_total: 25000, expenses_total: 5000, extra_income_total: 2000, withdrawals_total: 20000, opening_amount: 100000, final_cash_left: 80000, notes: ['Hielo'], total_days: 1 }
it('normalizes daily flows and preserves the final physical balance', () => {
 const day = rowToCashHistoryDay(row)
 expect(day.salesTotal).toBe(50000)
 expect(day.finalCashLeft).toBe(80000)
 expect(day.openingAmount).toBe(100000)
 expect(day.notes).toEqual(['Hielo'])
})
it('does not substitute zero for an unknown physical balance', () => {
 expect(rowToCashHistoryDay({ ...row, final_cash_left: null }).finalCashLeft).toBeNull()
})
it('rejects malformed totals at the data boundary', () => {
 expect(() => rowToCashHistoryDay({ ...row, cash_total: 'invalid' })).toThrow()
})
it('validates query dates and bounded pagination', () => {
 const query = { tiendaId: '00000000-0000-0000-0000-000000000001', start: new Date('2026-09-13T05:00:00Z'), endExclusive: new Date('2026-09-14T05:00:00Z'), closedBy: null, balanceStatus: 'all', page: 1, pageSize: 20 }
 expect(cashHistoryQuerySchema.safeParse(query).success).toBe(true)
 expect(cashHistoryQuerySchema.safeParse({ ...query, page: 0 }).success).toBe(false)
 expect(cashHistoryQuerySchema.safeParse({ ...query, pageSize: 101 }).success).toBe(false)
 expect(cashHistoryQuerySchema.safeParse({ ...query, endExclusive: query.start }).success).toBe(false)
})
