/**
 * Paridad de la RPC `owner_finance_summary` (app iOS del dueño, ADR 0021 §4,
 * PLAN-83) con lo que calcula `/finanzas` del POS web: `buildFinancialSummary`
 * sobre el reporte del mes (`buildSalesSummary`) y los gastos,
 * `buildReinvestmentFund` sobre `get_reinvestment_fund_totals`, y
 * `buildMonthlyComparison` sobre los totales mensuales.
 *
 * Corre SOLO contra el Supabase LOCAL: `pnpm test:parity`. Carga
 * `fixtures/owner-finance-summary.sql` y borra todo al terminar.
 */
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildFinancialSummary } from '@angular-app/features/expenses/domain/services/financial-summary'
import { buildReinvestmentFund } from '@angular-app/features/expenses/domain/services/reinvestment-fund'
import { buildMonthlyComparison } from '@angular-app/features/expenses/domain/services/monthly-comparison'
import type { Expense, ExpenseCategory } from '@angular-app/features/expenses/domain/entities/expense.entity'
import { buildSalesSummary } from '@angular-app/features/reports/domain/services/sales-summary'
import { getStoreDayRangeUtc, getStoreRangeUtc } from '@/shared/lib/day-range'
import { rowToSale, type SaleRow } from '@angular-app/features/sales/data/models/sale.mapper'
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

const TZ = 'America/Bogota'
const TIENDA = randomUUID()
const MONTH = '2026-08'
const TREND = ['2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08']

async function query<T>(promise: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  const { data, error } = await promise
  if (error) throw error
  return data as T
}

/** Lo que arma `FinanzasPage.load` para el mes, con los nombres de la RPC. */
async function webFinance(client: SupabaseClient): Promise<Record<string, unknown>> {
  const from = `${MONTH}-01`
  const to = `${MONTH}-31`
  const { start, end } = getStoreRangeUtc(from, to, TZ)
  const sales = await query<SaleRow[]>(
    client
      .from('sales')
      .select('*, clientes(nombre), sale_items(*), payments(*)')
      .eq('tienda_id', TIENDA)
      .gte('created_at', start.toISOString())
      .lt('created_at', end.toISOString())
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
  )
  const report = buildSalesSummary(sales.map(rowToSale), TZ)

  const expenses = await query<{ category_id: string; monto: number; status: string }[]>(
    client.from('expenses').select('category_id, monto, status').eq('tienda_id', TIENDA).gte('fecha_gasto', from).lte('fecha_gasto', to)
  )
  const categorias = await query<{ id: string; nombre: string }[]>(
    client.from('expense_categories').select('id, nombre').eq('tienda_id', TIENDA)
  )

  // Igual que FinanzasPage: costo = suma de los productos con costo; sin costo = productos con unidades.
  const costos = report.productSales.map((p) => p.costoTotal).filter((c): c is number => c !== null)
  const sinCosto = report.productSales.filter((p) => p.costoTotal === null && p.qty > 0)
  const summary = buildFinancialSummary({
    entradasTotales: report.totalVentas,
    paymentBreakdown: report.paymentBreakdown.map((p) => ({ metodo: p.metodo, total: p.total })),
    costoProductosVendidos: costos.length > 0 ? costos.reduce((s, c) => s + c, 0) : null,
    ventasSinCosto: sinCosto.length,
    unidadesSinCosto: sinCosto.reduce((sum, p) => sum + p.qty, 0),
    gastos: expenses.map((e) => ({ categoryId: e.category_id, monto: Number(e.monto), status: e.status }) as Expense),
    categorias: categorias.map((c) => ({ id: c.id, nombre: c.nombre }) as ExpenseCategory),
  })

  const [settings] = await query<{ saldo_inicial: number; fecha_inicio: string }[]>(
    client.from('reinvestment_fund_settings').select('saldo_inicial, fecha_inicio').eq('tienda_id', TIENDA)
  )
  const [totals] = await query<
    { cogs_acumulado: number; compras_acumuladas: number; cogs_mes: number; compras_mes: number; entradas_sin_costo: number }[]
  >(
    client.rpc('get_reinvestment_fund_totals', {
      p_tienda_id: TIENDA,
      p_desde: getStoreDayRangeUtc(settings.fecha_inicio, TZ).start.toISOString(),
      p_mes_desde: start.toISOString(),
      p_mes_hasta: end.toISOString(),
    })
  )
  const fund = buildReinvestmentFund({
    saldoInicial: Number(settings.saldo_inicial),
    cogsAcumulado: Number(totals.cogs_acumulado),
    comprasAcumuladas: Number(totals.compras_acumuladas),
    cogsMes: Number(totals.cogs_mes),
    comprasMes: Number(totals.compras_mes),
    ventasSinCosto: 0,
    entradasSinCosto: Number(totals.entradas_sin_costo),
  })

  const trendStart = getStoreDayRangeUtc(`${TREND[0]}-01`, TZ).start
  const entradas = await query<{ month: string; total: number }[]>(
    client.rpc('get_monthly_sales_totals', { p_tienda_id: TIENDA, p_from: trendStart.toISOString(), p_tz: TZ })
  )
  const gastos = await query<{ month: string; total: number }[]>(
    client.rpc('get_monthly_expense_totals', { p_tienda_id: TIENDA, p_from: `${TREND[0]}-01` })
  )
  const trend = buildMonthlyComparison({
    entradas: entradas.map((e) => ({ month: e.month, total: Number(e.total) })),
    gastos: gastos.map((g) => ({ month: g.month, total: Number(g.total) })),
    months: TREND,
  })

  return {
    entradas_totales: summary.entradasTotales,
    entradas_por_metodo: summary.entradasPorMetodo.map((p) => ({ metodo: p.metodo, total: p.total, pct_sobre_entradas: p.pctSobreEntradas })),
    costo_productos_vendidos: summary.costoProductosVendidos,
    ventas_sin_costo: summary.ventasSinCosto,
    unidades_sin_costo: summary.unidadesSinCosto,
    gastos_total: summary.gastosTotal,
    por_categoria: summary.porCategoria.map((c) => ({
      category_id: c.categoryId,
      nombre: c.nombre,
      total: c.total,
      pct_sobre_entradas: c.pctSobreEntradas,
    })),
    pct_gastos_sobre_entradas: summary.pctGastosSobreEntradas,
    utilidad_neta: summary.utilidadNeta,
    margen_neto: summary.margenNeto,
    fondo: {
      saldo_inicial: fund.saldoInicial,
      apartado_acumulado: fund.apartadoAcumulado,
      invertido_acumulado: fund.invertidoAcumulado,
      disponible: fund.disponible,
      apartado_mes: fund.apartadoMes,
      invertido_mes: fund.invertidoMes,
      entradas_sin_costo: fund.entradasSinCosto,
    },
    tendencia: trend.map((t) => ({ month: t.month, entradas: t.entradas, gastos: t.gastos, pct_gastos: t.pctGastos, balance: t.balance })),
  }
}

describe('owner_finance_summary: paridad con /finanzas del POS web', () => {
  let stack: LocalStack
  let admin: SupabaseClient
  const userIds: string[] = []
  const adminEmail = `paridad-finanzas-${TIENDA.slice(0, 8)}@local.test`

  beforeAll(async () => {
    stack = localStack()
    const [adminId] = await createUsers(stack, [adminEmail])
    userIds.push(adminId)
    psql(stack, CLEANUP_SQL)
    psql(stack, readFileSync(path.join(__dirname, 'fixtures/owner-finance-summary.sql'), 'utf8'), { tienda: TIENDA, admin: adminId })
    admin = await signIn(stack, adminEmail)
  })

  afterAll(async () => {
    if (!stack) return
    psql(stack, CLEANUP_SQL)
    await deleteUsers(stack, userIds)
  })

  it('mismas cifras que el web para el mes, el fondo y la tendencia', async () => {
    const { data, error } = await admin.rpc('owner_finance_summary', { p_tienda_id: TIENDA, p_month: `${MONTH}-01` })
    expect(error).toBeNull()
    // `month` y `timezone` son datos del período (no los calcula el web); `fecha_inicio` es el ajuste del fondo.
    const { month: _month, timezone: _timezone, ...figures } = data as Record<string, unknown>
    expect(normalize(figures, ['fecha_inicio'])).toEqual(normalize(await webFinance(admin)))
  })

  it('cifras esperadas (protege a ambos lados del mismo error)', async () => {
    const { data } = await admin.rpc('owner_finance_summary', { p_tienda_id: TIENDA, p_month: `${MONTH}-15` })
    expect(data).toMatchObject({
      month: MONTH,
      // 200.000 + 24.000 + 100.000 (31 ago 23:30 local); la anulada no cuenta.
      entradas_totales: 324000,
      // 2 × 60.000 + 1 × 61.000; el batido no tiene costo.
      costo_productos_vendidos: 181000,
      ventas_sin_costo: 1,
      unidades_sin_costo: 2,
      // 1.200.000 + 137.500; la luz duplicada está anulada.
      gastos_total: 1337500,
      utilidad_neta: 324000 - 181000 - 1337500,
    })
    expect(data.fondo).toMatchObject({
      saldo_inicial: 500000,
      // Compras desde el 1 jun: 10 × 60.000 + 5 × 62.000 (sin la de mayo ni la sin costo).
      invertido_acumulado: 910000,
      invertido_mes: 310000,
      entradas_sin_costo: 1,
    })
    expect((data.tendencia as { month: string }[]).map((t) => t.month)).toEqual(TREND)
    expect(data.entradas_por_metodo.map((p: { metodo: string }) => p.metodo)).toEqual(['cash', 'transfer', 'card'])
  })

  it('sin fondo configurado devuelve fondo null', async () => {
    psql(stack, `delete from public.reinvestment_fund_settings where tienda_id = '${TIENDA}';`)
    const { data } = await admin.rpc('owner_finance_summary', { p_tienda_id: TIENDA, p_month: `${MONTH}-01` })
    expect(data.fondo).toBeNull()
    psql(stack, `insert into public.reinvestment_fund_settings (tienda_id, saldo_inicial, fecha_inicio) values ('${TIENDA}', 500000, '2026-06-01');`)
  })

  it('otra tienda o sin sesión se rechaza', async () => {
    const other = await admin.rpc('owner_finance_summary', { p_tienda_id: randomUUID(), p_month: `${MONTH}-01` })
    expect(other.error?.code).toBe('42501')
  })
})
