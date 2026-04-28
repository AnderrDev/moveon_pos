import type { CashMovementType, CashSessionStatus, TiendaId, UserId } from '@/shared/types'

export interface CashSession {
  id: string
  tiendaId: TiendaId
  openedBy: UserId
  closedBy: UserId | null
  status: CashSessionStatus
  openingAmount: number
  expectedCashAmount: number | null
  actualCashAmount: number | null
  difference: number | null
  expectedSalesAmount: number | null
  actualSalesAmount: number | null
  salesDifference: number | null
  paymentClosure: unknown | null
  notasCierre: string | null
  openedAt: Date
  closedAt: Date | null
}

export interface CashMovement {
  id: string
  cashSessionId: string
  tipo: CashMovementType
  amount: number
  motivo: string
  createdBy: UserId
  createdAt: Date
}
