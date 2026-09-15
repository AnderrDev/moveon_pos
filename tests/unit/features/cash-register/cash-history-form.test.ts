import { expect, it } from 'vitest'
import { cashHistoryFormSchema, createCashHistoryFormDefaults } from '@angular-app/features/cash-register/presentation/forms/cash-history-form.factory'
import { toCashHistoryQuery } from '@angular-app/features/cash-register/presentation/forms/cash-history-form.mapper'
import { LatestRequest } from '@angular-app/features/cash-register/presentation/services/cash-history-request-state'
it('rejects reversed and invalid dates', () => {
  expect(cashHistoryFormSchema.safeParse({ ...createCashHistoryFormDefaults('2026-09-14'), from: '2026-09-15' }).success).toBe(false)
  expect(cashHistoryFormSchema.safeParse({ ...createCashHistoryFormDefaults('2026-09-14'), from: 'bad' }).success).toBe(false)
})
it('defaults to the last seven days', () => {
  expect(createCashHistoryFormDefaults('2026-09-14').from).toBe('2026-09-08')
})
it('maps inclusive store dates into a semiopen UTC range', () => {
  const query = toCashHistoryQuery({ ...createCashHistoryFormDefaults('2026-09-14'), preset: 'custom', from: '2026-09-13', to: '2026-09-14', balanceStatus: 'difference' }, { tiendaId: 'store', timezone: 'America/Bogota', page: 2 })
  expect(query.start.toISOString()).toBe('2026-09-13T05:00:00.000Z')
  expect(query.endExclusive.toISOString()).toBe('2026-09-15T05:00:00.000Z')
  expect(query.closedBy).toBeNull()
  expect(query.pageSize).toBe(20)
})
it('rejects stale request results', () => {
  const latest = new LatestRequest()
  const first = latest.begin()
  const second = latest.begin()
  expect(latest.isCurrent(first)).toBe(false)
  expect(latest.isCurrent(second)).toBe(true)
})
