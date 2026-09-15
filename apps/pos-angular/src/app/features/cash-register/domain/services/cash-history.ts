import type { CashSession } from '../entities/cash-session.entity'

export type CashHistoryPreset = 'today' | 'yesterday' | 'week' | 'month' | 'custom'
export type CashBalanceStatus = 'all' | 'balanced' | 'difference'
export interface CashHistoryQuery {
  tiendaId: string
  start: Date
  endExclusive: Date
  closedBy: string | null
  balanceStatus: CashBalanceStatus
  page: number
  pageSize: number
}
export interface CashHistoryPage { items: CashSession[]; total: number; page: number; pageSize: number }
export interface CashCloser { userId: string; email: string }

export function resolveCashHistoryPreset(today: string, preset: Exclude<CashHistoryPreset, 'custom'>): { from: string; to: string } {
  const shift = (days: number): string => {
    const date = new Date(`${today}T12:00:00Z`)
    date.setUTCDate(date.getUTCDate() + days)
    return date.toISOString().slice(0, 10)
  }
  if (preset === 'yesterday') return { from: shift(-1), to: shift(-1) }
  return { from: shift(preset === 'week' ? -6 : preset === 'month' ? -29 : 0), to: today }
}

export function getCashHistoryRange(page: number, pageSize: number): { from: number; to: number } {
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(pageSize) || pageSize < 1) throw new Error('Paginación inválida')
  return { from: (page - 1) * pageSize, to: page * pageSize - 1 }
}

export function getClosedPaymentSummary(value: unknown): { cash: { count: number; total: number }; transfer: { count: number; total: number } } {
  const summary = { cash: { count: 0, total: 0 }, transfer: { count: 0, total: 0 } }
  if (!value || typeof value !== 'object' || !('expected' in value) || !Array.isArray(value.expected)) return summary
  for (const row of value.expected as unknown[]) {
    if (!row || typeof row !== 'object' || !('metodo' in row) || (row.metodo !== 'cash' && row.metodo !== 'transfer')) continue
    const count = 'count' in row ? Number(row.count) : 0
    const total = 'total' in row ? Number(row.total) : 0
    summary[row.metodo].count += Number.isFinite(count) && count >= 0 ? count : 0
    summary[row.metodo].total += Number.isFinite(total) && total >= 0 ? total : 0
  }
  return summary
}
