import { describe, expect, it } from 'vitest'
import { applyCashHistoryFilters } from '@angular-app/features/cash-register/data/models/cash-history-query'

describe('history query filters', () => {
  it.each(['all', 'balanced', 'difference'] as const)('applies %s without changing the date field', (balanceStatus) => {
    const calls: unknown[][] = []
    const builder = {
      eq: (key: string, value: unknown) => { calls.push(['eq', key, value]); return builder },
      gte: (key: string, value: string) => { calls.push(['gte', key, value]); return builder },
      lt: (key: string, value: string) => { calls.push(['lt', key, value]); return builder },
      or: (value: string) => { calls.push(['or', value]); return builder },
    }
    applyCashHistoryFilters(builder, { tiendaId: 'store', start: new Date('2026-09-13T05:00:00Z'), endExclusive: new Date('2026-09-15T05:00:00Z'), closedBy: 'closer', balanceStatus, page: 1, pageSize: 20 })
    expect(calls).toContainEqual(['eq', 'status', 'closed'])
    expect(calls).toContainEqual(['eq', 'tienda_id', 'store'])
    expect(calls).toContainEqual(['gte', 'closed_at', '2026-09-13T05:00:00.000Z'])
    expect(calls).toContainEqual(['lt', 'closed_at', '2026-09-15T05:00:00.000Z'])
    expect(calls).toContainEqual(['eq', 'closed_by', 'closer'])
    if (balanceStatus === 'balanced') {
      expect(calls).toContainEqual(['eq', 'difference', 0])
      expect(calls).toContainEqual(['eq', 'sales_difference', 0])
    }
    if (balanceStatus === 'difference') expect(calls).toContainEqual(['or', 'difference.neq.0,sales_difference.neq.0'])
    if (balanceStatus === 'all') expect(calls).toHaveLength(5)
  })
})
