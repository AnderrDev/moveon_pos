import type { Result } from '@/shared/result'
import type { TiendaId, UserId, CashMovementType, PaymentMethod } from '@/shared/types'
import type { CashSession, CashMovement } from '../entities/cash-session.entity'

export interface CashSessionPaymentBreakdown {
  metodo: string
  count: number
  total: number
}

export interface CashSessionActualPayment {
  metodo: PaymentMethod
  total: number
}

export interface OpenSessionParams {
  tiendaId: TiendaId
  openedBy: UserId
  openingAmount: number
}

export interface AddMovementParams {
  cashSessionId: string
  tipo: CashMovementType
  amount: number
  motivo: string
  createdBy: UserId
}

export interface CloseSessionParams {
  sessionId: string
  tiendaId: TiendaId
  closedBy: UserId
  actualCashAmount: number
  actualPayments: CashSessionActualPayment[]
  notasCierre?: string
}

export interface CashRegisterRepository {
  getOpenSession(tiendaId: TiendaId): Promise<Result<CashSession | null>>
  getSessionById(id: string, tiendaId: TiendaId): Promise<Result<CashSession | null>>
  listSessions(tiendaId: TiendaId, limit?: number): Promise<Result<CashSession[]>>
  openSession(params: OpenSessionParams): Promise<Result<CashSession>>
  addMovement(params: AddMovementParams): Promise<Result<CashMovement>>
  listMovements(sessionId: string): Promise<Result<CashMovement[]>>
  getCashPaymentsTotal(sessionId: string, tiendaId: TiendaId): Promise<Result<number>>
  getPaymentBreakdown(sessionId: string, tiendaId: TiendaId): Promise<Result<CashSessionPaymentBreakdown[]>>
  closeSession(params: CloseSessionParams): Promise<Result<CashSession>>
}
