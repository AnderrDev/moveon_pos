import { inject, Injectable } from '@angular/core'
import { SupabaseClientService } from '@angular-app/core/supabase/supabase-client.service'
import { fetchAllPages } from '@angular-app/core/supabase/fetch-all-pages'
import { applyCashHistoryFilters } from '../models/cash-history-query'
import { getCashHistoryRange, type CashHistoryQuery, type CashHistoryPage, type CashCloser } from '../../domain/services/cash-history'
import { AuditLogRepository } from '@angular-app/features/audit/domain/repositories/audit-log.repository'
import {
  rowToCashMovement,
  rowToCashSession,
  type CashMovementRow,
  type CashSessionRow,
} from '@angular-app/features/cash-register/data/models/cash-register.mapper'
import type { CashMovement, CashSession } from '@angular-app/features/cash-register/domain/entities/cash-session.entity'
import {
  CashRegisterRepository as CashRegisterRepositoryContract,
  type AddMovementInput,
  type CloseSessionInput,
  type CorrectMovementInput,
  type CorrectOpeningInput,
  type OpenSessionInput,
  type PaymentBreakdown,
  type VoidMovementInput,
} from '@angular-app/features/cash-register/domain/repositories/cash-register.repository'

const SESSION_COLS =
  'id, tienda_id, opened_by, closed_by, closed_by_email, status, opening_amount, expected_cash_amount, actual_cash_amount, closing_withdrawal_amount, cash_left_amount, difference, expected_sales_amount, actual_sales_amount, sales_difference, payment_closure, notas_cierre, opened_at, closed_at'
const MOV_COLS =
  'id, cash_session_id, tipo, amount, motivo, created_by, created_at, status, voided_by, voided_at, voided_reason'

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
export class CashRegisterRepository extends CashRegisterRepositoryContract {
  private readonly supabaseClient = inject(SupabaseClientService)
  private readonly audit = inject(AuditLogRepository)

  async listClosedSessionsPage(input: CashHistoryQuery): Promise<CashHistoryPage> {
    const query = applyCashHistoryFilters(this.supabaseClient.supabase.from('cash_sessions').select(SESSION_COLS, { count: 'exact' }), input)
    const { from, to } = getCashHistoryRange(input.page, input.pageSize)
    const { data, error, count } = await query.order('closed_at', { ascending: false }).order('id', { ascending: false }).range(from, to).returns<CashSessionRow[]>()
    if (error) throw new Error(error.message)
    return { items: (data ?? []).map(rowToCashSession), total: count ?? 0, page: input.page, pageSize: input.pageSize }
  }

  async listCashClosers(tiendaId: string): Promise<CashCloser[]> {
    const { data, error } = await this.supabaseClient.supabase.rpc('list_cash_session_closers', { p_tienda_id: tiendaId })
    if (error) throw new Error(error.message)
    return (data ?? []).map((row) => ({ userId: row.user_id, email: row.email }))
  }

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

  async getSuggestedOpeningAmount(tiendaId: string): Promise<number | null> {
    const { data, error } = await this.supabaseClient.supabase
      .from('cash_sessions')
      .select('cash_left_amount')
      .eq('tienda_id', tiendaId)
      .eq('status', 'closed')
      .not('cash_left_amount', 'is', null)
      .order('closed_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return data?.cash_left_amount === null || data?.cash_left_amount === undefined
      ? null
      : Number(data.cash_left_amount)
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
    const rows = await fetchAllPages<CashSessionRow>(async (from, to) => {
      const { data, error } = await this.supabaseClient.supabase
        .from('cash_sessions')
        .select(SESSION_COLS)
        .eq('tienda_id', tiendaId)
        .gte('opened_at', start.toISOString())
        .lt('opened_at', end.toISOString())
        .order('opened_at', { ascending: false })
        .order('id', { ascending: false })
        .range(from, to)
        .returns<CashSessionRow[]>()
      if (error) throw new Error(error.message)
      return data ?? []
    })
    return rows.map(rowToCashSession)
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
    const session = rowToCashSession(data)
    void this.audit.log({
      tiendaId: input.tiendaId,
      entityType: 'sesion_caja',
      entityId: session.id,
      action: 'open',
      changes: { openingAmount: input.openingAmount },
    })
    return session
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

  async voidMovement(input: VoidMovementInput): Promise<void> {
    const rpc = this.supabaseClient.supabase as unknown as RpcClient
    const { error } = await rpc.rpc<string>('void_cash_movement_atomic', {
      p_movement_id: input.movementId,
      p_tienda_id: input.tiendaId,
      p_voided_by: input.voidedBy,
      p_voided_reason: input.voidedReason,
    })
    if (error) throw new Error(error.message)
    void this.audit.log({
      tiendaId: input.tiendaId,
      entityType: 'movimiento_caja',
      entityId: input.movementId,
      action: 'void',
      changes: { reason: input.voidedReason },
    })
  }

  async listMovements(sessionId: string): Promise<CashMovement[]> {
    const rows = await fetchAllPages<CashMovementRow>(async (from, to) => {
      const { data, error } = await this.supabaseClient.supabase
        .from('cash_movements')
        .select(MOV_COLS)
        .eq('cash_session_id', sessionId)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to)
        .returns<CashMovementRow[]>()
      if (error) throw new Error(error.message)
      return data ?? []
    })
    return rows.map(rowToCashMovement)
  }

  async getPaymentBreakdown(sessionId: string, tiendaId: string): Promise<PaymentBreakdown[]> {
    interface SalePayments {
      payments?: { metodo: string; amount: number }[]
    }
    const sales = await fetchAllPages<SalePayments>(async (from, to) => {
      const { data, error } = await this.supabaseClient.supabase
        .from('sales')
        .select('id, payments(metodo, amount)')
        .eq('cash_session_id', sessionId)
        .eq('tienda_id', tiendaId)
        .eq('status', 'completed')
        .order('id', { ascending: true })
        .range(from, to)
        .returns<SalePayments[]>()
      if (error) throw new Error(error.message)
      return data ?? []
    })

    const map = new Map<string, { count: number; total: number }>()
    for (const sale of sales) {
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
      p_cash_left: input.cashLeftAmount,
      p_actual_payments: input.actualPayments.map((p) => ({
        metodo: p.metodo,
        total: p.total,
      })),
      p_notas_cierre: input.notasCierre ?? null,
    })

    if (error) throw new Error(error.message)

    const session = await this.getSessionById(input.sessionId, input.tiendaId)
    if (!session) throw new Error('Cierre sin respuesta')
    void this.audit.log({
      tiendaId: input.tiendaId,
      entityType: 'sesion_caja',
      entityId: input.sessionId,
      action: 'close',
      changes: {
        actualCashAmount: input.actualCashAmount,
        closingWithdrawalAmount: input.actualCashAmount - input.cashLeftAmount,
        cashLeftAmount: input.cashLeftAmount,
        notasCierre: input.notasCierre ?? null,
      },
    })
    return session
  }

  async correctMovement(input: CorrectMovementInput): Promise<void> {
    const rpc = this.supabaseClient.supabase as unknown as RpcClient
    const { error } = await rpc.rpc<string>('correct_cash_movement_atomic', {
      p_movement_id: input.movementId,
      p_tienda_id: input.tiendaId,
      p_new_amount: input.newAmount,
      p_new_motivo: input.newMotivo,
      p_corrected_by: input.correctedBy,
      p_reason: input.reason,
    })
    if (error) throw new Error(error.message)
    void this.audit.log({
      tiendaId: input.tiendaId,
      entityType: 'movimiento_caja',
      entityId: input.movementId,
      action: 'correct_movement',
      changes: { newAmount: input.newAmount, newMotivo: input.newMotivo, reason: input.reason },
    })
  }

  async correctOpening(input: CorrectOpeningInput): Promise<CashSession> {
    const rpc = this.supabaseClient.supabase as unknown as RpcClient
    const { error } = await rpc.rpc<string>('correct_cash_session_opening_atomic', {
      p_session_id: input.sessionId,
      p_tienda_id: input.tiendaId,
      p_new_amount: input.newAmount,
      p_corrected_by: input.correctedBy,
      p_reason: input.reason,
    })
    if (error) throw new Error(error.message)

    const session = await this.getSessionById(input.sessionId, input.tiendaId)
    if (!session) throw new Error('Correccion sin respuesta')
    void this.audit.log({
      tiendaId: input.tiendaId,
      entityType: 'sesion_caja',
      entityId: input.sessionId,
      action: 'correct_opening',
      changes: { newAmount: input.newAmount, reason: input.reason },
    })
    return session
  }
}
