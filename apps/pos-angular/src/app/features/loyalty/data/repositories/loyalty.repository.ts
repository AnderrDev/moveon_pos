import { inject, Injectable } from '@angular/core'
import { SupabaseClientService } from '@angular-app/core/supabase/supabase-client.service'
import type {
  LoyaltyReward,
  LoyaltyRewardStatus,
  LoyaltyTransaction,
  LoyaltyTransactionType,
} from '@angular-app/features/loyalty/domain/entities/loyalty.entity'

interface AccountRow {
  stamps_balance: number
  total_stamps_earned: number
  total_rewards_redeemed: number
}

interface RewardRow {
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

interface TransactionRow {
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

const REWARD_COLS =
  'id, tienda_id, cliente_id, cost_stamps, reward_value_cop, status, generated_at, expires_at, redeemed_at, redeemed_sale_id, voided_at, voided_reason'

function rowToReward(row: RewardRow): LoyaltyReward {
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

export interface LoyaltySummary {
  stampsBalance: number
  totalStampsEarned: number
  totalRewardsRedeemed: number
  /** Recompensas disponibles y vigentes, la más próxima a vencer primero. */
  availableRewards: LoyaltyReward[]
}

interface RpcClient {
  rpc<T>(
    fn: string,
    args: Record<string, unknown>,
  ): Promise<{ data: T | null; error: { message: string } | null }>
}

type QueryResult<T> = Promise<{ data: T | null; error: { message: string } | null }>

/**
 * Las tablas de fidelización aún no existen en database.types.ts generado;
 * cliente estructural mientras se corre `pnpm db:types` tras aplicar la
 * migración 20260714_001 (mismo patrón que los demás repositorios).
 */
interface LoyaltyDbClient {
  from(table: 'loyalty_accounts'): {
    select(cols: string): {
      eq(col: string, value: unknown): {
        eq(col: string, value: unknown): {
          maybeSingle(): QueryResult<AccountRow>
        }
      }
    }
  }
  from(table: 'loyalty_rewards'): {
    select(cols: string): {
      eq(col: string, value: unknown): {
        eq(col: string, value: unknown): {
          eq(col: string, value: unknown): {
            gt(col: string, value: unknown): {
              order(col: string, opts: { ascending: boolean }): QueryResult<RewardRow[]>
            }
          }
        }
      }
    }
  }
  from(table: 'loyalty_transactions'): {
    select(cols: string): {
      eq(col: string, value: unknown): {
        eq(col: string, value: unknown): {
          order(col: string, opts: { ascending: boolean }): {
            limit(n: number): QueryResult<TransactionRow[]>
          }
        }
      }
    }
  }
}

@Injectable({ providedIn: 'root' })
export class LoyaltyRepository {
  private readonly supabaseClient = inject(SupabaseClientService)

  private get db(): LoyaltyDbClient {
    return this.supabaseClient.supabase as unknown as LoyaltyDbClient
  }

  /** Progreso + recompensas vigentes del cliente. Cliente sin cuenta = 0 sellos. */
  async getSummary(tiendaId: string, clienteId: string): Promise<LoyaltySummary> {
    const [accountResult, rewardsResult] = await Promise.all([
      this.db
        .from('loyalty_accounts')
        .select('stamps_balance, total_stamps_earned, total_rewards_redeemed')
        .eq('tienda_id', tiendaId)
        .eq('cliente_id', clienteId)
        .maybeSingle(),
      this.db
        .from('loyalty_rewards')
        .select(REWARD_COLS)
        .eq('tienda_id', tiendaId)
        .eq('cliente_id', clienteId)
        .eq('status', 'available')
        .gt('expires_at', new Date().toISOString())
        .order('expires_at', { ascending: true }),
    ])

    if (accountResult.error) throw new Error(accountResult.error.message)
    if (rewardsResult.error) throw new Error(rewardsResult.error.message)

    return {
      stampsBalance: accountResult.data?.stamps_balance ?? 0,
      totalStampsEarned: accountResult.data?.total_stamps_earned ?? 0,
      totalRewardsRedeemed: accountResult.data?.total_rewards_redeemed ?? 0,
      availableRewards: (rewardsResult.data ?? []).map(rowToReward),
    }
  }

  /** Ledger cronológico del cliente (acumulaciones, canjes, anulaciones, ajustes). */
  async listTransactions(tiendaId: string, clienteId: string, limit = 50): Promise<LoyaltyTransaction[]> {
    const { data, error } = await this.db
      .from('loyalty_transactions')
      .select('id, tienda_id, cliente_id, sale_id, type, stamps_delta, balance_after, reason, created_by, created_at')
      .eq('tienda_id', tiendaId)
      .eq('cliente_id', clienteId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw new Error(error.message)
    return (data ?? []).map((row) => ({
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
    }))
  }

  /**
   * Barrido de vencimiento (RN-LF09, PLAN-60): marca como `expired` las
   * recompensas vencidas de la tienda. Devuelve cuántas marcó. Lanza si el
   * RPC aún no existe en el entorno — el caller decide si lo ignora.
   */
  async expireRewards(tiendaId: string): Promise<number> {
    const rpcClient = this.supabaseClient.supabase as unknown as RpcClient
    const { data, error } = await rpcClient.rpc<number>('expire_loyalty_rewards', {
      p_tienda_id: tiendaId,
    })
    if (error) throw new Error(error.message)
    return data ?? 0
  }

  /** Ajuste manual admin-only (RN-LF16). Devuelve el nuevo saldo. */
  async adjustStamps(input: {
    tiendaId: string
    clienteId: string
    delta: number
    reason: string
    createdBy: string
  }): Promise<number> {
    const rpcClient = this.supabaseClient.supabase as unknown as RpcClient
    const { data, error } = await rpcClient.rpc<number>('adjust_loyalty_stamps', {
      p_tienda_id: input.tiendaId,
      p_cliente_id: input.clienteId,
      p_delta: input.delta,
      p_reason: input.reason,
      p_created_by: input.createdBy,
    })
    if (error) throw new Error(error.message)
    if (data === null) throw new Error('Ajuste sin respuesta')
    return data
  }
}
