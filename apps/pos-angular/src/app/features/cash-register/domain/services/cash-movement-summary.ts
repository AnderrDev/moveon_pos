import type { CashMovement } from '../entities/cash-session.entity'
export function getCashMovementSummary(movements: readonly Pick<CashMovement, 'tipo' | 'status' | 'amount'>[]): { extraIncome: number; expenses: number; withdrawals: number } {
 return movements.reduce((totals, movement) => {
  if (movement.status === 'voided') return totals
  if (movement.tipo === 'cash_in') totals.extraIncome += movement.amount
  if (movement.tipo === 'expense') totals.expenses += movement.amount
  if (movement.tipo === 'cash_out') totals.withdrawals += movement.amount
  return totals
 }, { extraIncome: 0, expenses: 0, withdrawals: 0 })
}
