import { getStoreRangeUtc } from '@angular-app/features/reports/domain/services/day-range'
import type { CashHistoryQuery } from '../../domain/services/cash-history'
import type { CashHistoryFormValue } from './cash-history-form.factory'
export function toCashHistoryQuery(value: CashHistoryFormValue, context: { tiendaId: string; timezone: string; page: number }): CashHistoryQuery {
  const range = getStoreRangeUtc(value.from, value.to, context.timezone)
  return { tiendaId: context.tiendaId, start: range.start, endExclusive: range.end, closedBy: value.closedBy || null, balanceStatus: value.balanceStatus, page: context.page, pageSize: 20 }
}
