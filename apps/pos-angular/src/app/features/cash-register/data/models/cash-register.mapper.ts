import type { CashSession, CashMovement } from '@angular-app/features/cash-register/domain/entities/cash-session.entity'
import type { CashSessionStatus, CashMovementType, CashMovementStatus } from '@/shared/types'

export interface CashSessionRow {
  id: string
  tienda_id: string
  opened_by: string
  closed_by: string | null
  status: string
  opening_amount: number
  expected_cash_amount: number | null
  actual_cash_amount: number | null
  difference: number | null
  expected_sales_amount: number | null
  actual_sales_amount: number | null
  sales_difference: number | null
  payment_closure: unknown | null
  notas_cierre: string | null
  opened_at: string
  closed_at: string | null
}

export interface CashMovementRow {
  id: string
  cash_session_id: string
  tipo: string
  amount: number
  motivo: string
  created_by: string
  created_at: string
  status: string
  voided_by: string | null
  voided_at: string | null
  voided_reason: string | null
}

export function rowToCashSession(row: CashSessionRow): CashSession {
  return {
    id: row.id,
    tiendaId: row.tienda_id,
    openedBy: row.opened_by,
    closedBy: row.closed_by,
    status: row.status as CashSessionStatus,
    openingAmount: Number(row.opening_amount),
    expectedCashAmount:
      row.expected_cash_amount !== null ? Number(row.expected_cash_amount) : null,
    actualCashAmount: row.actual_cash_amount !== null ? Number(row.actual_cash_amount) : null,
    difference: row.difference !== null ? Number(row.difference) : null,
    expectedSalesAmount:
      row.expected_sales_amount !== null ? Number(row.expected_sales_amount) : null,
    actualSalesAmount: row.actual_sales_amount !== null ? Number(row.actual_sales_amount) : null,
    salesDifference: row.sales_difference !== null ? Number(row.sales_difference) : null,
    paymentClosure: row.payment_closure,
    notasCierre: row.notas_cierre,
    openedAt: new Date(row.opened_at),
    closedAt: row.closed_at ? new Date(row.closed_at) : null,
  }
}

export function rowToCashMovement(row: CashMovementRow): CashMovement {
  return {
    id: row.id,
    cashSessionId: row.cash_session_id,
    tipo: row.tipo as CashMovementType,
    amount: Number(row.amount),
    motivo: row.motivo,
    createdBy: row.created_by,
    createdAt: new Date(row.created_at),
    status: row.status as CashMovementStatus,
    voidedBy: row.voided_by,
    voidedAt: row.voided_at ? new Date(row.voided_at) : null,
    voidedReason: row.voided_reason,
  }
}
