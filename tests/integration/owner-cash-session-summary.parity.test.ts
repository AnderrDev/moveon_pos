/**
 * Paridad de la RPC `owner_cash_session_summary` (app iOS del dueño, ADR 0021 §4,
 * PLAN-81) con lo que muestra `/caja` del POS web: `computeCashTurnSummary`
 * (cash-closure.ts) sobre el desglose de `getPaymentBreakdown` y los movimientos
 * del turno.
 *
 * Corre SOLO contra el Supabase LOCAL: `pnpm test:parity`. Carga
 * `fixtures/owner-cash-session-summary.sql` y borra todo al terminar.
 */
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  computeCashTurnSummary,
  type CashTurnMovement,
} from '@angular-app/features/cash-register/domain/services/cash-closure'
import {
  CLEANUP_SQL,
  createUsers,
  deleteUsers,
  localStack,
  normalize,
  psql,
  signIn,
  type LocalStack,
} from './support/local-stack'

const TIENDA = randomUUID()
const OPEN_SESSION = 'c6000000-0000-4000-8000-000000000002'
const CLOSED_SESSION = 'c6000000-0000-4000-8000-000000000001'

/**
 * Lo que calcula `/caja` del web para una sesión: el desglose como
 * `CashRegisterRepository.getPaymentBreakdown` (pagos de ventas completadas,
 * por método, ordenado por total) y el resumen con `computeCashTurnSummary`.
 */
async function webTurn(client: SupabaseClient, sessionId: string): Promise<Record<string, unknown>> {
  const { data: session, error: sessionError } = await client
    .from('cash_sessions')
    .select('id, status, opened_at, opening_amount')
    .eq('id', sessionId)
    .single()
  if (sessionError) throw sessionError

  const { data: sales, error: salesError } = await client
    .from('sales')
    .select('id, payments(metodo, amount)')
    .eq('cash_session_id', sessionId)
    .eq('tienda_id', TIENDA)
    .eq('status', 'completed')
  if (salesError) throw salesError
  const byMethod = new Map<string, { count: number; total: number }>()
  for (const sale of sales ?? []) {
    for (const payment of (sale.payments as { metodo: string; amount: number }[]) ?? []) {
      const current = byMethod.get(payment.metodo) ?? { count: 0, total: 0 }
      byMethod.set(payment.metodo, { count: current.count + 1, total: current.total + Number(payment.amount) })
    }
  }
  const breakdown = Array.from(byMethod.entries())
    .map(([metodo, v]) => ({ metodo, ...v }))
    .sort((a, b) => b.total - a.total)

  const { data: movements, error: movementsError } = await client
    .from('cash_movements')
    .select('tipo, amount, status')
    .eq('cash_session_id', sessionId)
  if (movementsError) throw movementsError

  const summary = computeCashTurnSummary(
    Number(session.opening_amount),
    breakdown.find((p) => p.metodo === 'cash')?.total ?? 0,
    (movements ?? []).map((m) => ({ ...m, amount: Number(m.amount) }) as CashTurnMovement)
  )

  return {
    session_id: session.id,
    status: session.status,
    opening_amount: summary.openingAmount,
    sales_total: breakdown.reduce((sum, p) => sum + p.total, 0),
    cash_sales_amount: summary.cashSalesAmount,
    cash_in_amount: summary.cashInAmount,
    expense_amount: summary.expenseAmount,
    cash_out_amount: summary.cashOutAmount,
    correction_amount: summary.correctionAmount,
    movements_total: summary.movementsTotal,
    expected_cash_amount: summary.expectedCashAmount,
    payment_breakdown: breakdown,
  }
}

describe('owner_cash_session_summary: paridad con /caja del POS web', () => {
  let stack: LocalStack
  let admin: SupabaseClient
  let cashier: SupabaseClient
  const userIds: string[] = []
  const adminEmail = `paridad-caja-admin-${TIENDA.slice(0, 8)}@local.test`
  const cashierEmail = `paridad-caja-cajero-${TIENDA.slice(0, 8)}@local.test`

  beforeAll(async () => {
    stack = localStack()
    const [adminId, cashierId] = await createUsers(stack, [adminEmail, cashierEmail])
    userIds.push(adminId, cashierId)
    psql(stack, CLEANUP_SQL)
    psql(stack, readFileSync(path.join(__dirname, 'fixtures/owner-cash-session-summary.sql'), 'utf8'), {
      tienda: TIENDA,
      admin: adminId,
      cajero: cashierId,
    })
    admin = await signIn(stack, adminEmail)
    cashier = await signIn(stack, cashierEmail)
  })

  afterAll(async () => {
    if (!stack) return
    psql(stack, CLEANUP_SQL)
    await deleteUsers(stack, userIds)
  })

  it.each([
    ['turno abierto (sin indicar sesión)', null, OPEN_SESSION],
    ['turno abierto por id', OPEN_SESSION, OPEN_SESSION],
    ['turno cerrado por id', CLOSED_SESSION, CLOSED_SESSION],
  ])('mismas cifras que el web: %s', async (_name, requested, expectedSession) => {
    const { data, error } = await admin.rpc('owner_cash_session_summary', { p_tienda_id: TIENDA, p_session_id: requested })
    expect(error).toBeNull()
    expect(normalize(data, ['opened_at'])).toEqual(normalize(await webTurn(admin, expectedSession)))
  })

  it('cifras esperadas del turno abierto (protege a ambos lados del mismo error)', async () => {
    const { data } = await admin.rpc('owner_cash_session_summary', { p_tienda_id: TIENDA })
    expect(data).toMatchObject({
      opening_amount: 100000,
      // 50.000 + 20.000 en efectivo; la anulada (99.000) no cuenta.
      cash_sales_amount: 70000,
      sales_total: 110000,
      // 15.000 − 8.000 − 20.000 − 3.000; el gasto anulado no cuenta.
      movements_total: -16000,
      expected_cash_amount: 154000,
    })
  })

  it('con la caja cerrada devuelve null', async () => {
    psql(stack, `update public.cash_sessions set status = 'closed', closed_at = now(), actual_cash_amount = 154000,
      closing_withdrawal_amount = 54000, cash_left_amount = 100000 where id = '${OPEN_SESSION}';`)
    const { data, error } = await admin.rpc('owner_cash_session_summary', { p_tienda_id: TIENDA })
    expect(error).toBeNull()
    expect(data).toBeNull()
    psql(stack, `update public.cash_sessions set status = 'open', closed_at = null, actual_cash_amount = null,
      closing_withdrawal_amount = null, cash_left_amount = null where id = '${OPEN_SESSION}';`)
  })

  it('un cajero no puede verla', async () => {
    const { error } = await cashier.rpc('owner_cash_session_summary', { p_tienda_id: TIENDA })
    expect(error?.code).toBe('42501')
  })

  it('el admin de esta tienda no ve otra tienda', async () => {
    const { error } = await admin.rpc('owner_cash_session_summary', { p_tienda_id: randomUUID() })
    expect(error?.code).toBe('42501')
  })
})
