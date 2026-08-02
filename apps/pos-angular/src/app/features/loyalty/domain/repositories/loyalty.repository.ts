import type { LoyaltyReward, LoyaltyTransaction } from '@angular-app/features/loyalty/domain/entities/loyalty.entity'

export interface LoyaltySummary {
  stampsBalance: number
  totalStampsEarned: number
  totalRewardsRedeemed: number
  /** Recompensas disponibles y vigentes, la más próxima a vencer primero. */
  availableRewards: LoyaltyReward[]
}

export interface AdjustStampsInput {
  tiendaId: string
  clienteId: string
  delta: number
  reason: string
  createdBy: string
}

/**
 * Contrato de persistencia del programa MOVE ON Club. Abstract class
 * (ADR 0015 §6.1). No existía interfaz previa — creado desde el uso real de
 * `LoyaltyRepository` (2026-07-17).
 */
export abstract class LoyaltyRepository {
  /** Progreso + recompensas vigentes del cliente. Cliente sin cuenta = 0 sellos. */
  abstract getSummary(tiendaId: string, clienteId: string): Promise<LoyaltySummary>
  /** Ledger cronológico del cliente (acumulaciones, canjes, anulaciones, ajustes). */
  abstract listTransactions(tiendaId: string, clienteId: string, limit?: number): Promise<LoyaltyTransaction[]>
  /** Barrido de vencimiento (RN-LF09): marca `expired` las recompensas vencidas. Devuelve cuántas marcó. */
  abstract expireRewards(tiendaId: string): Promise<number>
  /** Ajuste manual admin-only (RN-LF16). Devuelve el nuevo saldo. */
  abstract adjustStamps(input: AdjustStampsInput): Promise<number>
}
