import type {
  LoyaltyReward,
  LoyaltyRewardStatus,
  LoyaltyTransaction,
  LoyaltyTransactionType,
} from '@angular-app/features/loyalty/domain/entities/loyalty.entity'

export interface AccountRow {
  stamps_balance: number
  total_stamps_earned: number
  total_rewards_redeemed: number
}

export interface RewardRow {
  id: string
  tienda_id: string
  cliente_id: string
  cost_stamps: number
  reward_value_cop: number
  status: string
  generated_at: string
  expires_at: string
  redeemed_at: string | null
  redeemed_sale_id: string | null
  voided_at: string | null
  voided_reason: string | null
}

export interface TransactionRow {
  id: string
  tienda_id: string
  cliente_id: string
  sale_id: string | null
  type: string
  stamps_delta: number
  balance_after: number
  reason: string | null
  created_by: string
  created_at: string
}

export const REWARD_COLS =
  'id, tienda_id, cliente_id, cost_stamps, reward_value_cop, status, generated_at, expires_at, redeemed_at, redeemed_sale_id, voided_at, voided_reason'

export function rowToReward(row: RewardRow): LoyaltyReward {
  return {
    id: row.id,
    tiendaId: row.tienda_id,
    clienteId: row.cliente_id,
    costStamps: row.cost_stamps,
    rewardValueCop: Number(row.reward_value_cop),
    status: row.status as LoyaltyRewardStatus,
    generatedAt: new Date(row.generated_at),
    expiresAt: new Date(row.expires_at),
    redeemedAt: row.redeemed_at ? new Date(row.redeemed_at) : null,
    redeemedSaleId: row.redeemed_sale_id,
    voidedAt: row.voided_at ? new Date(row.voided_at) : null,
    voidedReason: row.voided_reason,
  }
}

export function rowToTransaction(row: TransactionRow): LoyaltyTransaction {
  return {
    id: row.id,
    tiendaId: row.tienda_id,
    clienteId: row.cliente_id,
    saleId: row.sale_id,
    type: row.type as LoyaltyTransactionType,
    stampsDelta: row.stamps_delta,
    balanceAfter: row.balance_after,
    reason: row.reason,
    createdBy: row.created_by,
    createdAt: new Date(row.created_at),
  }
}
