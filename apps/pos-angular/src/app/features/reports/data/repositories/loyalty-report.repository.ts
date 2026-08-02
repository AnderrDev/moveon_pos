import { inject, Injectable } from '@angular/core'
import { SupabaseClientService } from '@angular-app/core/supabase/supabase-client.service'
import { TiendaInfoService } from '@angular-app/core/tienda/tienda-info.service'
import { LoyaltyRepository } from '@angular-app/features/loyalty/domain/repositories/loyalty.repository'
import { expireRewards } from '@angular-app/features/loyalty/domain/usecases/expire-rewards.use-case'
import { getStoreRangeUtc } from '@angular-app/features/reports/domain/services/day-range'
import { LoyaltyReportRepository } from '@angular-app/features/reports/domain/repositories/loyalty-report.repository'
import {
  buildLoyaltyProgramReport,
  type LoyaltyProgramReport,
  type LoyaltyRewardSample,
  type LoyaltyTransactionSample,
} from '@angular-app/features/loyalty/domain/services/program-report'
import type {
  LoyaltyRewardStatus,
  LoyaltyTransactionType,
} from '@angular-app/features/loyalty/domain/entities/loyalty.entity'

interface TxReportRow {
  cliente_id: string
  type: string
  stamps_delta: number
  cliente: { nombre: string } | null
}

interface RewardReportRow {
  status: string
  generated_at: string
  redeemed_at: string | null
  expires_at: string
}

type QueryResult<T> = Promise<{ data: T | null; error: { message: string } | null }>

/**
 * Las tablas de fidelización aún no existen en database.types.ts generado;
 * cliente estructural, mismo patrón que LoyaltyRepository.
 */
interface LoyaltyReportDbClient {
  from(table: 'loyalty_transactions'): {
    select(cols: string): {
      eq(col: string, value: unknown): {
        gte(col: string, value: unknown): {
          lt(col: string, value: unknown): QueryResult<TxReportRow[]>
        }
      }
    }
  }
  from(table: 'loyalty_rewards'): {
    select(cols: string): {
      eq(col: string, value: unknown): QueryResult<RewardReportRow[]>
    }
  }
}

/**
 * Reporte del programa MOVE ON Club para /reportes (PLAN-60). Relocalizada
 * desde `presentation/services/loyalty-report.service.ts` (PLAN-66,
 * ADR 0015 §3): toca Supabase directo, así que vive en `data/`.
 */
@Injectable({ providedIn: 'root' })
export class LoyaltyReportsRepository extends LoyaltyReportRepository {
  private readonly supabaseClient = inject(SupabaseClientService)
  private readonly tiendaInfo = inject(TiendaInfoService)
  private readonly loyaltyRepo = inject(LoyaltyRepository)

  private get db(): LoyaltyReportDbClient {
    return this.supabaseClient.supabase as unknown as LoyaltyReportDbClient
  }

  /**
   * KPIs del período `[fromIso, toIso]` (días locales inclusivos) en la zona
   * horaria de la tienda. Antes de consultar corre el barrido de vencimiento
   * (PLAN-60) — si el RPC no existe en el entorno, el reporte sale igual.
   */
  async getReport(
    tiendaId: string,
    fromIso: string,
    toIso: string,
  ): Promise<LoyaltyProgramReport> {
    const { timezone } = await this.tiendaInfo.get(tiendaId)
    const { start, end } = getStoreRangeUtc(fromIso, toIso, timezone)

    await expireRewards({ repo: this.loyaltyRepo }, tiendaId).catch(() => 0)

    const [txResult, rewardsResult] = await Promise.all([
      this.db
        .from('loyalty_transactions')
        .select('cliente_id, type, stamps_delta, cliente:clientes(nombre)')
        .eq('tienda_id', tiendaId)
        .gte('created_at', start.toISOString())
        .lt('created_at', end.toISOString()),
      this.db
        .from('loyalty_rewards')
        .select('status, generated_at, redeemed_at, expires_at')
        .eq('tienda_id', tiendaId),
    ])

    if (txResult.error) throw new Error(txResult.error.message)
    if (rewardsResult.error) throw new Error(rewardsResult.error.message)

    const transactions: LoyaltyTransactionSample[] = (txResult.data ?? []).map((row) => ({
      clienteId: row.cliente_id,
      clienteNombre: row.cliente?.nombre ?? null,
      type: row.type as LoyaltyTransactionType,
      stampsDelta: row.stamps_delta,
    }))

    const rewards: LoyaltyRewardSample[] = (rewardsResult.data ?? []).map((row) => ({
      status: row.status as LoyaltyRewardStatus,
      generatedAt: new Date(row.generated_at),
      redeemedAt: row.redeemed_at ? new Date(row.redeemed_at) : null,
      expiresAt: new Date(row.expires_at),
    }))

    return buildLoyaltyProgramReport(transactions, rewards, {
      start,
      end,
      now: new Date(),
    })
  }
}
