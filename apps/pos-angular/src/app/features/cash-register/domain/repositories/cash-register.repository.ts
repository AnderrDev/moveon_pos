import type { CashMovement, CashSession } from '@angular-app/features/cash-register/domain/entities/cash-session.entity'
import type { CashMovementType, PaymentMethod } from '@/shared/types'

export interface PaymentBreakdown {
  metodo: string
  count: number
  total: number
}

export interface OpenSessionInput {
  tiendaId: string
  openedBy: string
  openingAmount: number
}

export interface AddMovementInput {
  cashSessionId: string
  tipo: CashMovementType
  amount: number
  motivo: string
  createdBy: string
}

export interface VoidMovementInput {
  movementId: string
  tiendaId: string
  voidedBy: string
  voidedReason: string
}

export interface CloseSessionInput {
  sessionId: string
  tiendaId: string
  closedBy: string
  actualCashAmount: number
  actualPayments: { metodo: PaymentMethod; total: number }[]
  notasCierre?: string
}

export interface CorrectOpeningInput {
  sessionId: string
  tiendaId: string
  newAmount: number
  correctedBy: string
  reason: string
}

/**
 * Contrato de persistencia del módulo de caja. Abstract class (no interface):
 * TS puro, cero Angular, y sirve como token de inyección de dependencias
 * (ADR 0015 §6.1). La implementación vive en
 * `apps/pos-angular/src/app/features/cash-register/data/repositories/cash-register.repository.ts`.
 * Reescrito desde el uso real (decisión 2026-07-17): la interfaz previa
 * (`Result<T>`, `getCashPaymentsTotal`) era aspiracional y no coincidía con
 * la implementación en producción.
 */
export abstract class CashRegisterRepository {
  abstract getOpenSession(tiendaId: string): Promise<CashSession | null>
  abstract getSessionById(id: string, tiendaId: string): Promise<CashSession | null>
  abstract listSessions(tiendaId: string, limit?: number): Promise<CashSession[]>
  abstract listSessionsByDateRange(tiendaId: string, start: Date, end: Date): Promise<CashSession[]>
  abstract openSession(input: OpenSessionInput): Promise<CashSession>
  abstract addMovement(input: AddMovementInput): Promise<CashMovement>
  abstract voidMovement(input: VoidMovementInput): Promise<void>
  abstract listMovements(sessionId: string): Promise<CashMovement[]>
  abstract getPaymentBreakdown(sessionId: string, tiendaId: string): Promise<PaymentBreakdown[]>
  abstract closeSession(input: CloseSessionInput): Promise<CashSession>
  abstract correctOpening(input: CorrectOpeningInput): Promise<CashSession>
}
