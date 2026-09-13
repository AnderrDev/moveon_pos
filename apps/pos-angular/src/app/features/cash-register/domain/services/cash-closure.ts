/**
 * Cash closure domain helpers (pure TS).
 *
 * Used by the close-session dialog to surface, per payment method, the live
 * difference between the physical count and the expected amount, so the cashier
 * is not typing blind.
 *
 * IMPORTANT — sign convention:
 * This module models the difference as `counted - expected` (UI-facing):
 *   - positive  => surplus  ("sobra", el conteo supera lo esperado)
 *   - negative  => shortfall ("falta", el conteo no llega a lo esperado)
 *   - zero      => balanced ("cuadra")
 *
 * This is the OPPOSITE sign of the persisted `difference` column, which the RPC
 * `close_cash_session_atomic` computes as `expected - actual`. The RPC remains
 * the single source of truth for what gets persisted; these helpers only drive
 * the on-screen hint and are never sent to the backend.
 */

/**
 * Threshold (COP) above which the close-session note becomes mandatory.
 * Mirrors the RPC's `v_threshold := 5000`, but the RPC stays authoritative;
 * this constant only powers the client-side hint/guard.
 */
export const CASH_DIFFERENCE_THRESHOLD = 5000

/** Efectivo separado después de contar el cajón y antes de finalizar el cierre. */
export function computeClosingWithdrawal(actualCashAmount: number, cashLeftAmount: number): number {
  return actualCashAmount - cashLeftAmount
}

export interface CashTurnMovement {
  tipo: 'cash_in' | 'cash_out' | 'expense' | 'correction'
  amount: number
  status: 'active' | 'voided'
}

export interface CashTurnSummary {
  openingAmount: number
  cashSalesAmount: number
  cashInAmount: number
  expenseAmount: number
  cashOutAmount: number
  correctionAmount: number
  movementsTotal: number
  expectedCashAmount: number
}

/** Desglose auditable del efectivo que debería existir físicamente en el cajón. */
export function computeCashTurnSummary(
  openingAmount: number,
  cashSalesAmount: number,
  movements: CashTurnMovement[]
): CashTurnSummary {
  const active = movements.filter((movement) => movement.status === 'active')
  const totalFor = (tipo: CashTurnMovement['tipo']): number =>
    active
      .filter((movement) => movement.tipo === tipo)
      .reduce((total, movement) => total + movement.amount, 0)

  const cashInAmount = totalFor('cash_in')
  const expenseAmount = totalFor('expense')
  const cashOutAmount = totalFor('cash_out')
  const correctionAmount = totalFor('correction')
  const movementsTotal = cashInAmount - expenseAmount - cashOutAmount - correctionAmount

  return {
    openingAmount,
    cashSalesAmount,
    cashInAmount,
    expenseAmount,
    cashOutAmount,
    correctionAmount,
    movementsTotal,
    expectedCashAmount: openingAmount + cashSalesAmount + movementsTotal,
  }
}

/**
 * Live, UI-facing difference for a single payment method.
 *
 * @param expected - amount the system expects for the method.
 * @param counted - amount the cashier physically counted.
 * @returns `counted - expected` (positive = surplus, negative = shortfall).
 */
export function computeMethodDifference(expected: number, counted: number): number {
  return counted - expected
}

/**
 * Whether a difference is balanced (exactly zero).
 */
export function isBalanced(difference: number): boolean {
  return difference === 0
}

/**
 * Whether the absolute difference is strictly greater than the threshold,
 * which is what makes the closing note mandatory.
 *
 * At exactly the threshold (±$5.000) it returns `false` (note not required);
 * beyond it (either surplus or shortfall) it returns `true`.
 */
export function exceedsThreshold(
  difference: number,
  threshold = CASH_DIFFERENCE_THRESHOLD
): boolean {
  return Math.abs(difference) > threshold
}
