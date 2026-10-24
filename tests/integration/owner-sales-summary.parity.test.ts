/**
 * Paridad de la RPC `owner_sales_summary` (app iOS del dueño, ADR 0021 §4,
 * PLAN-78) con `buildSalesSummary`, el cálculo del reporte del POS web.
 *
 * Corre SOLO contra el Supabase LOCAL (regla del dueño: pruebas con datos en
 * local): `pnpm test:parity`. Crea dos usuarios por la API de admin de GoTrue,
 * carga `fixtures/owner-sales-summary.sql` con psql en el contenedor de la DB,
 * lee las ventas como lo hace `SalesRepository.listByDate`, y compara el TS con
 * la RPC. Al terminar borra todo lo que creó.
 */
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildSalesSummary, type SalesSummary } from '@angular-app/features/reports/domain/services/sales-summary'
import { getStoreRangeUtc } from '@angular-app/features/reports/domain/services/day-range'
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
const OTRA = randomUUID()

/** Mismas ventas que `SalesRepository.listByDate` (mismo rango y orden), mapeadas con `rowToSale`. */
async function webSummary(client: SupabaseClient, fromIso: string, toIso: string): Promise<SalesSummary> {
  const { start, end } = getStoreRangeUtc(fromIso, toIso, TZ)
  const { data, error } = await client
    .from('sales')
    .select('*, clientes(nombre), sale_items(*), payments(*)')
    .eq('tienda_id', TIENDA)
    .gte('created_at', start.toISOString())
    .lt('created_at', end.toISOString())
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .returns<SaleRow[]>()
  if (error) throw error
  return buildSalesSummary((data ?? []).map(rowToSale), TZ)
}

/** El resumen del web con los nombres de la RPC. */
function toRpcShape(s: SalesSummary): Record<string, unknown> {
  return {
    total_ventas: s.totalVentas,
    count_ventas: s.countVentas,
    count_anuladas: s.countAnuladas,
    subtotal_ventas: s.subtotalVentas,
    tax_total: s.taxTotal,
    discount_total: s.discountTotal,
    item_discount_total: s.itemDiscountTotal,
    global_discount_total: s.globalDiscountTotal,
    discounted_sales_count: s.discountedSalesCount,
    average_discount_percentage: s.averageDiscountPercentage,
    avg_venta: s.avgVenta,
    utilidad_total: s.utilidadTotal,
    payment_breakdown: s.paymentBreakdown.map((p) => ({ metodo: p.metodo, count: p.count, total: p.total })),
    product_sales: s.productSales.map((p) => ({
      product_id: p.productId,
      nombre: p.nombre,
      sku: p.sku,
      num_ventas: p.numVentas,
      qty: p.qty,
      total: p.total,
      avg_price: p.avgPrice,
      costo_unitario: p.costoUnitario,
      costo_total: p.costoTotal,
      utilidad: p.utilidad,
      margen_pct: p.margenPct,
    })),
    cashier_breakdown: s.cashierBreakdown.map((c) => ({
      cashier_id: c.cashierId,
      count_completed: c.countCompleted,
      count_voided: c.countVoided,
      total_ventas: c.totalVentas,
      tax_total: c.taxTotal,
    })),
    hourly_sales: s.hourlySales.map((h) => ({ hour: h.hour, count: h.count, total: h.total, avg_ticket: h.avgTicket })),
    daily_sales: s.dailySales.map((d) => ({ date: d.date, count: d.count, total: d.total, avg_ticket: d.avgTicket })),
  }
}

/** Sin los campos que el web no tiene. */
const DROP_KEYS = ['from', 'to', 'timezone', 'cashier_email']

describe('owner_sales_summary: paridad con el reporte del POS web', () => {
  let stack: LocalStack
  let admin: SupabaseClient
  let cashier: SupabaseClient
  const userIds: string[] = []
  const adminEmail = `paridad-admin-${TIENDA.slice(0, 8)}@local.test`
  const cashierEmail = `paridad-cajero-${TIENDA.slice(0, 8)}@local.test`

  beforeAll(async () => {
    stack = localStack()
    const [adminId, cashierId] = await createUsers(stack, [adminEmail, cashierEmail])
    userIds.push(adminId, cashierId)
    psql(stack, CLEANUP_SQL)
    psql(stack, readFileSync(path.join(__dirname, 'fixtures/owner-sales-summary.sql'), 'utf8'), {
      tienda: TIENDA,
      otra: OTRA,
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

  async function rpc(client: SupabaseClient, from: string, to: string) {
    return client.rpc('owner_sales_summary', { p_tienda_id: TIENDA, p_from: from, p_to: to })
  }

  it.each([
    ['dos días', '2026-10-20', '2026-10-21'],
    ['un día (venta de las 23:30 incluida)', '2026-10-20', '2026-10-20'],
    ['período sin ventas', '2026-09-01', '2026-09-30'],
  ])('mismas cifras que el web: %s', async (_name, from, to) => {
    const { data, error } = await rpc(admin, from, to)
    expect(error).toBeNull()
    expect(normalize(data, DROP_KEYS)).toEqual(normalize(toRpcShape(await webSummary(admin, from, to)), DROP_KEYS))
  })

  it('cifras esperadas del período de dos días (protege a ambos lados del mismo error)', async () => {
    const { data } = await rpc(admin, '2026-10-20', '2026-10-21')
    expect(data).toMatchObject({
      from: '2026-10-20',
      to: '2026-10-21',
      timezone: TZ,
      total_ventas: 71200,
      count_ventas: 4,
      count_anuladas: 1,
      // Descuento global de S2 y canje del Club de S5 (el canje cuenta en discount_total).
      discounted_sales_count: 2,
      avg_venta: 17800,
      // Proteína 39000 − 16200 + combo 25000 − 12346 + batido canjeado 0 − 3500.
      utilidad_total: 31954,
    })
    const products = data.product_sales as { nombre: string; costo_total: number | null; utilidad: number | null }[]
    expect(products.map((p) => p.nombre)).toEqual([
      'Proteína paridad (nuevo nombre)',
      'Combo paridad',
      'Snack sin costo',
      'Batido paridad',
    ])
    expect(products.find((p) => p.nombre === 'Snack sin costo')).toMatchObject({ costo_total: null, utilidad: null })
    const cashiers = data.cashier_breakdown as { cashier_email: string | null }[]
    expect(cashiers.map((c) => c.cashier_email).sort()).toEqual([adminEmail, cashierEmail].sort())
  })

  it('un día: la venta de las 23:30 hora Colombia cuenta en ese día', async () => {
    const { data } = await rpc(admin, '2026-10-20', '2026-10-20')
    expect(data).toMatchObject({ total_ventas: 61200, count_ventas: 3, count_anuladas: 1 })
    expect(data.hourly_sales).toContainEqual({ hour: 23, count: 1, total: 25000, avg_ticket: 25000 })
  })

  it('un cajero no puede ver el resumen', async () => {
    const { error } = await rpc(cashier, '2026-10-20', '2026-10-21')
    expect(error?.code).toBe('42501')
  })

  it('sin sesión no se puede llamar', async () => {
    const anon = createClient(stack.url, stack.anonKey, { auth: { persistSession: false } })
    const { error } = await rpc(anon, '2026-10-20', '2026-10-21')
    expect(error?.code).toBe('42501')
  })

  it('el admin de otra tienda no ve esta tienda', async () => {
    const { data, error } = await admin.rpc('owner_sales_summary', { p_tienda_id: randomUUID(), p_from: '2026-10-20', p_to: '2026-10-21' })
    expect(data).toBeNull()
    expect(error?.code).toBe('42501')
  })

  it.each([
    ['fin antes del inicio', '2026-10-21', '2026-10-20'],
    ['más de un año', '2025-01-01', '2026-10-21'],
  ])('rango inválido: %s', async (_name, from, to) => {
    const { error } = await rpc(admin, from, to)
    expect(error?.code).toBe('22023')
  })
})
