import type { TiendaId } from '@/shared/types'

export type LoyaltyTransactionType = 'earn' | 'redeem' | 'void' | 'adjustment' | 'expire'
export type LoyaltyRewardStatus = 'available' | 'redeemed' | 'expired' | 'voided'

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

/**
 * Lo mínimo que fidelización necesita de un cliente. `Cliente` (customers) lo
 * cumple estructuralmente; definirlo aquí evita que loyalty dependa de
 * customers (customers ya depende de loyalty → sería un ciclo).
 */
export interface LoyaltyCustomerRef {
  id: string
  nombre: string
}
