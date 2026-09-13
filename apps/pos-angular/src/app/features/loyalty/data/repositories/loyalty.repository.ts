import { inject, Injectable } from '@angular/core'
import { SupabaseClientService } from '@angular-app/core/supabase/supabase-client.service'
import { fetchAllPages } from '@angular-app/core/supabase/fetch-all-pages'
import type { LoyaltyTransaction } from '@angular-app/features/loyalty/domain/entities/loyalty.entity'
import {
  LoyaltyRepository as LoyaltyRepositoryContract,
  type AdjustStampsInput,
  type LoyaltyCustomerProgress,
  type LoyaltySummary,
} from '@angular-app/features/loyalty/domain/repositories/loyalty.repository'
import {
  REWARD_COLS,
  rowToReward,
  rowToTransaction,
  type AccountRow,
  type RewardRow,
  type TransactionRow,
} from '@angular-app/features/loyalty/data/models/loyalty.mapper'

interface RpcClient {
  rpc<T>(
    fn: string,
    args: Record<string, unknown>
  ): Promise<{ data: T | null; error: { message: string } | null }>
}

type QueryResult<T> = Promise<{ data: T | null; error: { message: string } | null }>

interface AccountProgressRow {
  cliente_id: string
  stamps_balance: number
}

interface RewardProgressRow {
  id: string
  cliente_id: string
}

interface AccountProgressOrderedQuery {
  range(from: number, to: number): QueryResult<AccountProgressRow[]>
}

interface RewardProgressOrderedQuery {
  order(col: string, opts: { ascending: boolean }): RewardProgressOrderedQuery
  range(from: number, to: number): QueryResult<RewardProgressRow[]>
}

interface LoyaltyProgressDbClient {
  from(table: 'loyalty_accounts'): {
    select(cols: string): {
      eq(
        col: string,
        value: unknown
      ): {
        order(col: string, opts: { ascending: boolean }): AccountProgressOrderedQuery
      }
    }
  }
  from(table: 'loyalty_rewards'): {
    select(cols: string): {
      eq(
        col: string,
        value: unknown
      ): {
        eq(
          col: string,
          value: unknown
        ): {
          gt(
            col: string,
            value: unknown
          ): {
            order(col: string, opts: { ascending: boolean }): RewardProgressOrderedQuery
          }
        }
      }
    }
  }
}

/**
 * Las tablas de fidelización aún no existen en database.types.ts generado;
 * cliente estructural mientras se corre `pnpm db:types` tras aplicar la
 * migración 20260714_001 (mismo patrón que los demás repositorios).
 */
interface LoyaltyDbClient {
  from(table: 'loyalty_accounts'): {
    select(cols: string): {
      eq(
        col: string,
        value: unknown
      ): {
        eq(
          col: string,
          value: unknown
        ): {
          maybeSingle(): QueryResult<AccountRow>
        }
      }
    }
  }
  from(table: 'loyalty_rewards'): {
    select(cols: string): {
      eq(
        col: string,
        value: unknown
      ): {
        eq(
          col: string,
          value: unknown
        ): {
          eq(
            col: string,
            value: unknown
          ): {
            gt(
              col: string,
              value: unknown
            ): {
              order(col: string, opts: { ascending: boolean }): QueryResult<RewardRow[]>
            }
          }
        }
      }
    }
  }
  from(table: 'loyalty_transactions'): {
    select(cols: string): {
      eq(
        col: string,
        value: unknown
      ): {
        eq(
          col: string,
          value: unknown
        ): {
          order(
            col: string,
            opts: { ascending: boolean }
          ): {
            limit(n: number): QueryResult<TransactionRow[]>
          }
        }
      }
    }
  }
}

@Injectable({ providedIn: 'root' })
export class LoyaltyRepository extends LoyaltyRepositoryContract {
  private readonly supabaseClient = inject(SupabaseClientService)

  private get db(): LoyaltyDbClient {
    return this.supabaseClient.supabase as unknown as LoyaltyDbClient
  }

  /** Dos lecturas paginadas para todo el directorio; evita el patrón N+1 por cliente. */
  async listCustomerProgress(tiendaId: string): Promise<LoyaltyCustomerProgress[]> {
    const db = this.supabaseClient.supabase as unknown as LoyaltyProgressDbClient
    const [accounts, rewards] = await Promise.all([
      fetchAllPages<AccountProgressRow>(async (from, to) => {
        const { data, error } = await db
          .from('loyalty_accounts')
          .select('cliente_id, stamps_balance')
          .eq('tienda_id', tiendaId)
          .order('cliente_id', { ascending: true })
          .range(from, to)
        if (error) throw new Error(error.message)
        return data ?? []
      }),
      fetchAllPages<RewardProgressRow>(async (from, to) => {
        const { data, error } = await db
          .from('loyalty_rewards')
          .select('id, cliente_id')
          .eq('tienda_id', tiendaId)
          .eq('status', 'available')
          .gt('expires_at', new Date().toISOString())
          .order('cliente_id', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to)
        if (error) throw new Error(error.message)
        return data ?? []
      }),
    ])

    const byCustomer = new Map<string, LoyaltyCustomerProgress>()
    for (const account of accounts) {
      byCustomer.set(account.cliente_id, {
        clienteId: account.cliente_id,
        stampsBalance: account.stamps_balance,
        availableRewards: 0,
      })
    }
    for (const reward of rewards) {
      const current = byCustomer.get(reward.cliente_id)
      byCustomer.set(reward.cliente_id, {
        clienteId: reward.cliente_id,
        stampsBalance: current?.stampsBalance ?? 0,
        availableRewards: (current?.availableRewards ?? 0) + 1,
      })
    }
    return [...byCustomer.values()]
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
  async listTransactions(
    tiendaId: string,
    clienteId: string,
    limit = 50
  ): Promise<LoyaltyTransaction[]> {
    const { data, error } = await this.db
      .from('loyalty_transactions')
      .select(
        'id, tienda_id, cliente_id, sale_id, type, stamps_delta, balance_after, reason, created_by, created_at'
      )
      .eq('tienda_id', tiendaId)
      .eq('cliente_id', clienteId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw new Error(error.message)
    return (data ?? []).map(rowToTransaction)
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
  async adjustStamps(input: AdjustStampsInput): Promise<number> {
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
