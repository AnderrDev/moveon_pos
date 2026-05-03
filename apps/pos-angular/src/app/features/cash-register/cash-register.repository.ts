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

const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'card', 'nequi', 'daviplata', 'transfer', 'other']

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
    update(values: Record<string, unknown>): {
      eq(col: string, value: unknown): {
        eq(col: string, value: unknown): {
          eq(col: string, value: unknown): {
            select(cols: string): {
              single<T>(): Promise<{ data: T | null; error: { message: string } | null }>
            }
          }
        }
      }
    }
  }
}

function normalize(breakdown: PaymentBreakdown[]): PaymentBreakdown[] {
  const map = new Map(breakdown.map((p) => [p.metodo, p]))
  return PAYMENT_METHODS.map((metodo) => ({
    metodo,
    count: map.get(metodo)?.count ?? 0,
    total: map.get(metodo)?.total ?? 0,
  }))
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
    const supabase = this.supabaseClient.supabase

    const { data: movs, error: movErr } = await supabase
      .from('cash_movements')
      .select('tipo, amount')
      .eq('cash_session_id', input.sessionId)
      .returns<{ tipo: string; amount: number }[]>()
    if (movErr) throw new Error(movErr.message)

    const session = await this.getSessionById(input.sessionId, input.tiendaId)
    if (!session) throw new Error('Sesion no encontrada')
    if (session.status !== 'open') throw new Error('La caja ya esta cerrada')

    const breakdown = normalize(await this.getPaymentBreakdown(input.sessionId, input.tiendaId))
    const expectedCashSales = breakdown.find((p) => p.metodo === 'cash')?.total ?? 0
    const expectedSalesAmount = breakdown.reduce((sum, p) => sum + p.total, 0)

    const movTotal = (movs ?? []).reduce((sum, m) => {
      const amt = Number(m.amount)
      return m.tipo === 'cash_in' ? sum + amt : sum - amt
    }, 0)

    const expectedCashInDrawer = session.openingAmount + expectedCashSales + movTotal
    const cashDifference = expectedCashInDrawer - input.actualCashAmount

    const actualByMethod = new Map<PaymentMethod, number>()
    for (const payment of input.actualPayments) actualByMethod.set(payment.metodo, payment.total)

    const actualCashSales = input.actualCashAmount - session.openingAmount - movTotal
    const actualPayments = PAYMENT_METHODS.map((metodo) => ({
      metodo,
      total: metodo === 'cash' ? actualCashSales : actualByMethod.get(metodo) ?? 0,
    }))
    const actualSalesAmount = actualPayments.reduce((sum, payment) => sum + payment.total, 0)
    const salesDifference = expectedSalesAmount - actualSalesAmount

    if (
      (Math.abs(cashDifference) > 5000 || Math.abs(salesDifference) > 5000) &&
      !input.notasCierre?.trim()
    ) {
      throw new Error('Diferencias mayores a $5.000 requieren nota de cierre')
    }

    const client = supabase as unknown as UntypedClient
    const { data, error } = await client
      .from('cash_sessions')
      .update({
        status: 'closed',
        closed_by: input.closedBy,
        actual_cash_amount: input.actualCashAmount,
        expected_cash_amount: expectedCashInDrawer,
        difference: cashDifference,
        expected_sales_amount: expectedSalesAmount,
        actual_sales_amount: actualSalesAmount,
        sales_difference: salesDifference,
        payment_closure: { expected: breakdown, actual: actualPayments },
        notas_cierre: input.notasCierre ?? null,
        closed_at: new Date().toISOString(),
      })
      .eq('id', input.sessionId)
      .eq('tienda_id', input.tiendaId)
      .eq('status', 'open')
      .select(SESSION_COLS)
      .single<CashSessionRow>()

    if (error) throw new Error(error.message)
    if (!data) throw new Error('Cierre sin respuesta')
    return rowToCashSession(data)
  }
}
