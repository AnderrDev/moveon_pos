import { createClient } from '@/infrastructure/supabase/server'
import { ok, err } from '@/shared/result'
import type { Result } from '@/shared/result'
import type { TiendaId } from '@/shared/types'
import type { CashSession, CashMovement } from '../../domain/entities/cash-session.entity'
import type {
  CashRegisterRepository,
  OpenSessionParams,
  AddMovementParams,
  CloseSessionParams,
} from '../../domain/repositories/cash-register.repository'
import {
  rowToCashSession,
  rowToCashMovement,
  type CashSessionRow,
  type CashMovementRow,
} from '../mappers/cash-register.mapper'

// @supabase/ssr v0.5 no resuelve los tipos Insert/Update a través de createServerClient.
/* eslint-disable @typescript-eslint/no-explicit-any */

const SESSION_COLS = 'id, tienda_id, opened_by, closed_by, status, opening_amount, expected_cash_amount, actual_cash_amount, difference, notas_cierre, opened_at, closed_at'
const MOV_COLS    = 'id, cash_session_id, tipo, amount, motivo, created_by, created_at'

export class SupabaseCashRegisterRepository implements CashRegisterRepository {
  async getOpenSession(tiendaId: TiendaId): Promise<Result<CashSession | null>> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('cash_sessions')
      .select(SESSION_COLS)
      .eq('tienda_id', tiendaId)
      .eq('status', 'open')
      .maybeSingle()
      .returns<CashSessionRow>()

    if (error) return err(new Error(error.message))
    return ok(data ? rowToCashSession(data) : null)
  }

  async getSessionById(id: string, tiendaId: TiendaId): Promise<Result<CashSession | null>> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('cash_sessions')
      .select(SESSION_COLS)
      .eq('id', id)
      .eq('tienda_id', tiendaId)
      .maybeSingle()
      .returns<CashSessionRow>()

    if (error) return err(new Error(error.message))
    return ok(data ? rowToCashSession(data) : null)
  }

  async listSessions(tiendaId: TiendaId, limit = 20): Promise<Result<CashSession[]>> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('cash_sessions')
      .select(SESSION_COLS)
      .eq('tienda_id', tiendaId)
      .order('opened_at', { ascending: false })
      .limit(limit)
      .returns<CashSessionRow[]>()

    if (error) return err(new Error(error.message))
    return ok((data ?? []).map(rowToCashSession))
  }

  async openSession(params: OpenSessionParams): Promise<Result<CashSession>> {
    const supabase = await createClient()
    const { data, error } = await (supabase as any)
      .from('cash_sessions')
      .insert({
        tienda_id:      params.tiendaId,
        opened_by:      params.openedBy,
        opening_amount: params.openingAmount,
        status:         'open',
      })
      .select(SESSION_COLS)
      .single()

    if (error) return err(new Error(error.message))
    return ok(rowToCashSession(data as CashSessionRow))
  }

  async addMovement(params: AddMovementParams): Promise<Result<CashMovement>> {
    const supabase = await createClient()
    const { data, error } = await (supabase as any)
      .from('cash_movements')
      .insert({
        cash_session_id: params.cashSessionId,
        tipo:            params.tipo,
        amount:          params.amount,
        motivo:          params.motivo,
        created_by:      params.createdBy,
      })
      .select(MOV_COLS)
      .single()

    if (error) return err(new Error(error.message))
    return ok(rowToCashMovement(data as CashMovementRow))
  }

  async listMovements(sessionId: string): Promise<Result<CashMovement[]>> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('cash_movements')
      .select(MOV_COLS)
      .eq('cash_session_id', sessionId)
      .order('created_at', { ascending: true })
      .returns<CashMovementRow[]>()

    if (error) return err(new Error(error.message))
    return ok((data ?? []).map(rowToCashMovement))
  }

  async closeSession(params: CloseSessionParams): Promise<Result<CashSession>> {
    const supabase = await createClient()

    // Calcula expected_cash_amount como suma de movimientos + apertura
    const { data: movs } = await supabase
      .from('cash_movements')
      .select('tipo, amount')
      .eq('cash_session_id', params.sessionId)
      .returns<Array<{ tipo: string; amount: number }>>()

    const sessionResult = await this.getSessionById(params.sessionId, params.tiendaId)
    if (!sessionResult.ok) return err(sessionResult.error)
    if (!sessionResult.value) return err(new Error('Sesión no encontrada'))

    const session = sessionResult.value
    const movTotal = (movs ?? []).reduce((sum, m) => {
      const amt = Number(m.amount)
      return m.tipo === 'cash_in' ? sum + amt : sum - amt
    }, 0)

    const expected = session.openingAmount + movTotal
    const difference = params.actualCashAmount - expected

    const { data, error } = await (supabase as any)
      .from('cash_sessions')
      .update({
        status:               'closed',
        closed_by:            params.closedBy,
        actual_cash_amount:   params.actualCashAmount,
        expected_cash_amount: expected,
        difference,
        notas_cierre:         params.notasCierre ?? null,
        closed_at:            new Date().toISOString(),
      })
      .eq('id', params.sessionId)
      .eq('tienda_id', params.tiendaId)
      .select(SESSION_COLS)
      .single()

    if (error) return err(new Error(error.message))
    return ok(rowToCashSession(data as CashSessionRow))
  }
}
