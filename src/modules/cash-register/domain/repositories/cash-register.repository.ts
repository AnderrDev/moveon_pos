import type { Result } from '@/shared/result'
import type { TiendaId, UserId, CashMovementType } from '@/shared/types'
import type { CashSession, CashMovement } from '../entities/cash-session.entity'

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
  notasCierre?: string
}

export interface CashRegisterRepository {
  getOpenSession(tiendaId: TiendaId): Promise<Result<CashSession | null>>
  getSessionById(id: string, tiendaId: TiendaId): Promise<Result<CashSession | null>>
  listSessions(tiendaId: TiendaId, limit?: number): Promise<Result<CashSession[]>>
  openSession(params: OpenSessionParams): Promise<Result<CashSession>>
  addMovement(params: AddMovementParams): Promise<Result<CashMovement>>
  listMovements(sessionId: string): Promise<Result<CashMovement[]>>
  closeSession(params: CloseSessionParams): Promise<Result<CashSession>>
}
