import type { CashSession, CashMovement } from '../../domain/entities/cash-session.entity'
import type { CashSessionStatus, CashMovementType } from '@/shared/types'

export type CashSessionRow = {
  id: string
  tienda_id: string
  opened_by: string
  closed_by: string | null
  status: string
  opening_amount: number
  expected_cash_amount: number | null
  actual_cash_amount: number | null
  difference: number | null
  notas_cierre: string | null
  opened_at: string
  closed_at: string | null
}

export type CashMovementRow = {
  id: string
  cash_session_id: string
  tipo: string
  amount: number
  motivo: string
  created_by: string
  created_at: string
}

export function rowToCashSession(row: CashSessionRow): CashSession {
  return {
    id:                   row.id,
    tiendaId:             row.tienda_id,
    openedBy:             row.opened_by,
    closedBy:             row.closed_by,
    status:               row.status as CashSessionStatus,
    openingAmount:        Number(row.opening_amount),
    expectedCashAmount:   row.expected_cash_amount !== null ? Number(row.expected_cash_amount) : null,
    actualCashAmount:     row.actual_cash_amount   !== null ? Number(row.actual_cash_amount)   : null,
    difference:           row.difference           !== null ? Number(row.difference)           : null,
    notasCierre:          row.notas_cierre,
    openedAt:             new Date(row.opened_at),
    closedAt:             row.closed_at ? new Date(row.closed_at) : null,
  }
}

export function rowToCashMovement(row: CashMovementRow): CashMovement {
  return {
    id:             row.id,
    cashSessionId:  row.cash_session_id,
    tipo:           row.tipo as CashMovementType,
    amount:         Number(row.amount),
    motivo:         row.motivo,
    createdBy:      row.created_by,
    createdAt:      new Date(row.created_at),
  }
}
