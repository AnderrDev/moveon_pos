import type { CashHistoryQuery } from '../../domain/services/cash-history'

interface HistoryFilterBuilder<T> {
  eq(column: string, value: string | number): T
  gte(column: string, value: string): T
  lt(column: string, value: string): T
  or(filters: string): T
}
export function applyCashHistoryFilters<T extends HistoryFilterBuilder<T>>(builder: T, input: CashHistoryQuery): T {
  let query = builder.eq('tienda_id', input.tiendaId).eq('status', 'closed')
    .gte('closed_at', input.start.toISOString()).lt('closed_at', input.endExclusive.toISOString())
  if (input.closedBy) query = query.eq('closed_by', input.closedBy)
  if (input.balanceStatus === 'balanced') query = query.eq('difference', 0).eq('sales_difference', 0)
  if (input.balanceStatus === 'difference') query = query.or('difference.neq.0,sales_difference.neq.0')
  return query
}
