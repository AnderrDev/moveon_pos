import { inject, Injectable } from '@angular/core'
import { SupabaseClientService } from '../../core/supabase/supabase-client.service'
import {
  rowToCashMovement,
  rowToCashSession,
  type CashMovementRow,
  type CashSessionRow,
} from '@/modules/cash-register/infrastructure/mappers/cash-register.mapper'
import type { CashMovement, CashSession } from '@/modules/cash-register/domain/entities/cash-session.entity'
import type { CashMovementType, PaymentMethod } from '@/shared/types'

const SESSION_COLS =
  'id, tienda_id, opened_by, closed_by, status, opening_amount, expected_cash_amount, actual_cash_amount, difference, expected_sales_amount, actual_sales_amount, sales_difference, payment_closure, notas_cierre, opened_at, closed_at'
const MOV_COLS = 'id, cash_session_id, tipo, amount, motivo, created_by, created_at'

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

export interface CloseSessionInput {
  sessionId: string
  tiendaId: string
  closedBy: string
  actualCashAmount: number
  actualPayments: { metodo: PaymentMethod; total: number }[]
  notasCierre?: string
}

interface UntypedClient {
  from(table: string): {
    insert(values: Record<string, unknown>): {
      select(cols: string): {
        single<T>(): Promise<{ data: T | null; error: { message: string } | null }>
      }
    }
  }
}

interface RpcClient {
  rpc<T>(
    fn: string,
    args: Record<string, unknown>,
  ): Promise<{ data: T | null; error: { message: string } | null }>
}

@Injectable({ providedIn: 'root' })
export class CashRegisterRepository {
  private readonly supabaseClient = inject(SupabaseClientService)

  async getOpenSession(tiendaId: string): Promise<CashSession | null> {
    const { data, error } = await this.supabaseClient.supabase
      .from('cash_sessions')
      .select(SESSION_COLS)
      .eq('tienda_id', tiendaId)
      .eq('status', 'open')
      .maybeSingle()
      .returns<CashSessionRow>()
    if (error) throw new Error(error.message)
    return data ? rowToCashSession(data) : null
  }

  async getSessionById(id: string, tiendaId: string): Promise<CashSession | null> {
    const { data, error } = await this.supabaseClient.supabase
      .from('cash_sessions')
      .select(SESSION_COLS)
      .eq('id', id)
      .eq('tienda_id', tiendaId)
      .maybeSingle()
      .returns<CashSessionRow>()
    if (error) throw new Error(error.message)
    return data ? rowToCashSession(data) : null
  }

  async listSessions(tiendaId: string, limit = 20): Promise<CashSession[]> {
    const { data, error } = await this.supabaseClient.supabase
      .from('cash_sessions')
      .select(SESSION_COLS)
      .eq('tienda_id', tiendaId)
      .order('opened_at', { ascending: false })
      .limit(limit)
      .returns<CashSessionRow[]>()
    if (error) throw new Error(error.message)
    return (data ?? []).map(rowToCashSession)
  }

  async listSessionsByDateRange(
    tiendaId: string,
    start: Date,
    end: Date,
  ): Promise<CashSession[]> {
    const { data, error } = await this.supabaseClient.supabase
      .from('cash_sessions')
      .select(SESSION_COLS)
      .eq('tienda_id', tiendaId)
      .gte('opened_at', start.toISOString())
      .lte('opened_at', end.toISOString())
      .order('opened_at', { ascending: false })
      .returns<CashSessionRow[]>()
    if (error) throw new Error(error.message)
    return (data ?? []).map(rowToCashSession)
  }

  async openSession(input: OpenSessionInput): Promise<CashSession> {
    const client = this.supabaseClient.supabase as unknown as UntypedClient
    const { data, error } = await client
      .from('cash_sessions')
      .insert({
        tienda_id: input.tiendaId,
        opened_by: input.openedBy,
        opening_amount: input.openingAmount,
        status: 'open',
      })
      .select(SESSION_COLS)
      .single<CashSessionRow>()
    if (error) throw new Error(error.message)
    if (!data) throw new Error('Sesion creada sin respuesta')
    return rowToCashSession(data)
  }

  async addMovement(input: AddMovementInput): Promise<CashMovement> {
    const client = this.supabaseClient.supabase as unknown as UntypedClient
    const { data, error } = await client
      .from('cash_movements')
      .insert({
        cash_session_id: input.cashSessionId,
        tipo: input.tipo,
        amount: input.amount,
        motivo: input.motivo,
        created_by: input.createdBy,
      })
      .select(MOV_COLS)
      .single<CashMovementRow>()
    if (error) throw new Error(error.message)
    if (!data) throw new Error('Movimiento sin respuesta')
    return rowToCashMovement(data)
  }

  async listMovements(sessionId: string): Promise<CashMovement[]> {
    const { data, error } = await this.supabaseClient.supabase
      .from('cash_movements')
      .select(MOV_COLS)
      .eq('cash_session_id', sessionId)
      .order('created_at', { ascending: true })
      .returns<CashMovementRow[]>()
    if (error) throw new Error(error.message)
    return (data ?? []).map(rowToCashMovement)
  }

  async getPaymentBreakdown(sessionId: string, tiendaId: string): Promise<PaymentBreakdown[]> {
    const { data, error } = await this.supabaseClient.supabase
      .from('sales')
      .select('payments(metodo, amount)')
      .eq('cash_session_id', sessionId)
      .eq('tienda_id', tiendaId)
      .eq('status', 'completed')
      .returns<{ payments?: { metodo: string; amount: number }[] }[]>()

    if (error) throw new Error(error.message)

    const map = new Map<string, { count: number; total: number }>()
    for (const sale of data ?? []) {
      for (const payment of sale.payments ?? []) {
        const cur = map.get(payment.metodo) ?? { count: 0, total: 0 }
        map.set(payment.metodo, {
          count: cur.count + 1,
          total: cur.total + Number(payment.amount),
        })
      }
    }

    return Array.from(map.entries())
      .map(([metodo, value]) => ({ metodo, ...value }))
      .sort((a, b) => b.total - a.total)
  }

  async closeSession(input: CloseSessionInput): Promise<CashSession> {
    const rpc = this.supabaseClient.supabase as unknown as RpcClient
    const { error } = await rpc.rpc<string>('close_cash_session_atomic', {
      p_session_id: input.sessionId,
      p_tienda_id: input.tiendaId,
      p_closed_by: input.closedBy,
      p_actual_cash: input.actualCashAmount,
      p_actual_payments: input.actualPayments.map((p) => ({
        metodo: p.metodo,
        total: p.total,
      })),
      p_notas_cierre: input.notasCierre ?? null,
    })

    if (error) throw new Error(error.message)

    const session = await this.getSessionById(input.sessionId, input.tiendaId)
    if (!session) throw new Error('Cierre sin respuesta')
    return session
  }
}
