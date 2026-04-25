import type { CashSessionStatus, PaymentMethod, TiendaId, UserId } from '@/shared/types'

export interface CashSession {
  id: string
  tiendaId: TiendaId
  openedBy: UserId
  closedBy: UserId | null
  status: CashSessionStatus
  openingBalance: number
  expectedBalance: number
  actualBalance: number | null
  difference: number | null
  openedAt: Date
  closedAt: Date | null
}

export interface CashMovement {
  id: string
  cashSessionId: string
  tiendaId: TiendaId
  type: 'ingreso' | 'egreso'
  amount: number
  method: PaymentMethod
  description: string
  createdBy: UserId
  createdAt: Date
}
