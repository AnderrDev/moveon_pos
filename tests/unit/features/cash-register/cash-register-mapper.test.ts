import { describe, expect, it } from 'vitest'
import {
  rowToCashSession,
  type CashSessionRow,
} from '@angular-app/features/cash-register/data/models/cash-register.mapper'

function makeRow(overrides: Partial<CashSessionRow> = {}): CashSessionRow {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    tienda_id: '11111111-1111-4111-8111-111111111111',
    opened_by: '33333333-3333-4333-8333-333333333333',
    closed_by: '44444444-4444-4444-8444-444444444444',
    closed_by_email: 'responsable@moveon.test',
    status: 'closed',
    opening_amount: 150_000,
    expected_cash_amount: 480_000,
    actual_cash_amount: 480_000,
    closing_withdrawal_amount: 330_000,
    cash_left_amount: 150_000,
    difference: 0,
    expected_sales_amount: 330_000,
    actual_sales_amount: 330_000,
    sales_difference: 0,
    payment_closure: { expected: [], actual: [] },
    notas_cierre: null,
    opened_at: '2026-09-13T10:00:00.000Z',
    closed_at: '2026-09-13T18:00:00.000Z',
    ...overrides,
  }
}

describe('rowToCashSession', () => {
  it('mapea el retiro y el efectivo dejado de un cierre', () => {
    const session = rowToCashSession(makeRow())

    expect(session.closingWithdrawalAmount).toBe(330_000)
    expect(session.cashLeftAmount).toBe(150_000)
    expect(session.closedByEmail).toBe('responsable@moveon.test')
  })

  it('conserva valores nulos en una sesión abierta o histórica incompleta', () => {
    const session = rowToCashSession(makeRow({
      status: 'open',
      closed_by: null,
      actual_cash_amount: null,
      closing_withdrawal_amount: null,
      cash_left_amount: null,
      closed_at: null,
    }))

    expect(session.closingWithdrawalAmount).toBeNull()
    expect(session.cashLeftAmount).toBeNull()
  })
})
