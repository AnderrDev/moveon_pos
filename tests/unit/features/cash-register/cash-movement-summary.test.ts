import { expect, it } from 'vitest'
import { getCashMovementSummary } from '@angular-app/features/cash-register/domain/services/cash-movement-summary'
it('sums active flows separately and excludes voided movements', () => {
 expect(getCashMovementSummary([
  { tipo: 'cash_in', status: 'active', amount: 2000 },
  { tipo: 'expense', status: 'active', amount: 5000 },
  { tipo: 'cash_out', status: 'active', amount: 10000 },
  { tipo: 'expense', status: 'voided', amount: 99999 },
 ])).toEqual({ extraIncome: 2000, expenses: 5000, withdrawals: 10000 })
})
