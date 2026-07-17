import type { TiendaId } from '@/shared/types'

export type LoyaltyTransactionType = 'earn' | 'redeem' | 'void' | 'adjustment' | 'expire'
export type LoyaltyRewardStatus = 'available' | 'redeemed' | 'expired' | 'voided'

/** Proyección de conveniencia. La fuente de verdad es el ledger (RN-LF15). */
export interface LoyaltyAccount {
  id: string
  tiendaId: TiendaId
  clienteId: string
  stampsBalance: number
  totalStampsEarned: number
  totalRewardsRedeemed: number
  createdAt: Date
  updatedAt: Date
}

export interface LoyaltyTransaction {
  id: string
  tiendaId: TiendaId
  clienteId: string
  saleId: string | null
  type: LoyaltyTransactionType
  stampsDelta: number
  balanceAfter: number
  reason: string | null
  createdBy: string
  createdAt: Date
}

export interface LoyaltyReward {
  id: string
  tiendaId: TiendaId
  clienteId: string
  costStamps: number
  rewardValueCop: number
  status: LoyaltyRewardStatus
  generatedAt: Date
  expiresAt: Date
  redeemedAt: Date | null
  redeemedSaleId: string | null
  voidedAt: Date | null
  voidedReason: string | null
}
