import { describe, expect, it } from 'vitest'
import { getCashHistoryRange, getClosedPaymentSummary, resolveCashHistoryPreset } from '@angular-app/features/cash-register/domain/services/cash-history'

describe('cash history', () => {
  it.each([
    ['today', '2026-09-14'], ['yesterday', '2026-09-13'],
    ['week', '2026-09-08'], ['month', '2026-08-16'],
  ] as const)('resolves %s inclusively', (preset, from) => {
    expect(resolveCashHistoryPreset('2026-09-14', preset)).toEqual({ from, to: preset === 'yesterday' ? from : '2026-09-14' })
  })
  it('crosses month and year boundaries', () => {
    expect(resolveCashHistoryPreset('2026-01-01', 'week').from).toBe('2025-12-26')
  })
  it('returns inclusive database page offsets', () => {
    expect(getCashHistoryRange(2, 20)).toEqual({ from: 20, to: 39 })
    expect(() => getCashHistoryRange(0, 20)).toThrow()
  })
  it('reads only recorded expected payment totals', () => {
    expect(getClosedPaymentSummary({ expected: [
      { metodo: 'cash', count: 7, total: 350000 },
      { metodo: 'transfer', count: 3, total: 180000 },
    ], actual: [{ metodo: 'cash', total: 1 }] })).toEqual({ cash: { count: 7, total: 350000 }, transfer: { count: 3, total: 180000 } })
  })
  it.each([null, {}, { expected: null }, { expected: [null, { metodo: 'cash', count: 'x', total: 'x' }] }])('handles malformed snapshots safely', (value) => {
    expect(getClosedPaymentSummary(value)).toEqual({ cash: { count: 0, total: 0 }, transfer: { count: 0, total: 0 } })
  })
})
