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
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildSalesSummary, type SalesSummary } from '@angular-app/features/reports/domain/services/sales-summary'
import { getStoreRangeUtc } from '@angular-app/features/reports/domain/services/day-range'
import { rowToSale, type SaleRow } from '@angular-app/features/sales/data/models/sale.mapper'

const ROOT = path.resolve(__dirname, '../..')
const TZ = 'America/Bogota'
const PASSWORD = 'Paridad1234!'
const TIENDA = randomUUID()
const OTRA = randomUUID()

interface LocalStack {
  url: string
  anonKey: string
  serviceRoleKey: string
  dbContainer: string
}

/**
 * `supabase status` del CLI instalado en el sistema: bajo pnpm/npx el PATH
 * empieza por `node_modules/.bin`, que trae un CLI viejo que no entiende el
 * config.toml. Puede salir con código ≠ 0 si hay servicios opcionales
 * detenidos (Studio, Storage…), pero igual imprime los datos.
 */
function supabaseStatus(): string {
  const PATH = (process.env['PATH'] ?? '')
    .split(path.delimiter)
    .filter((dir) => !dir.includes(`node_modules${path.sep}.bin`))
    .join(path.delimiter)
  try {
    return execFileSync('supabase', ['status', '-o', 'env'], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PATH },
    })
  } catch (error) {
    const stdout = (error as { stdout?: string }).stdout
    if (stdout) return stdout
    throw error
  }
}

function localStack(): LocalStack {
  const env = supabaseStatus()
  const get = (key: string): string => {
    const match = env.match(new RegExp(`^${key}="?([^"\\n]+)"?$`, 'm'))
    if (!match) throw new Error(`Falta ${key} en "supabase status": ¿está corriendo el Supabase local?`)
    return match[1]
  }
  const url = get('API_URL')
  if (!/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url)) {
    throw new Error(`La paridad solo corre contra el Supabase local, no contra ${url}`)
  }
  const projectId = readFileSync(path.join(ROOT, 'supabase/config.toml'), 'utf8').match(/^project_id\s*=\s*"([^"]+)"/m)?.[1]
  return { url, anonKey: get('ANON_KEY'), serviceRoleKey: get('SERVICE_ROLE_KEY'), dbContainer: `supabase_db_${projectId}` }
}

function psql(stack: LocalStack, sql: string, vars: Record<string, string> = {}): void {
  const args = ['exec', '-i', stack.dbContainer, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
  for (const [key, value] of Object.entries(vars)) args.push('-v', `${key}=${value}`)
  execFileSync('docker', args, { input: sql, stdio: ['pipe', 'ignore', 'pipe'] })
}

/** Borra las tiendas de paridad (también las que dejó una corrida que falló). */
const CLEANUP_SQL = `
  create temp table paridad_tiendas as select id from public.tiendas where nombre like 'Paridad %';
  delete from public.payments where sale_id in (select id from public.sales where tienda_id in (select id from paridad_tiendas));
  delete from public.sale_items where sale_id in (select id from public.sales where tienda_id in (select id from paridad_tiendas));
  delete from public.audit_logs where tienda_id in (select id from paridad_tiendas);
  delete from public.sales where tienda_id in (select id from paridad_tiendas);
  delete from public.inventory_movements where tienda_id in (select id from paridad_tiendas);
  delete from public.cash_sessions where tienda_id in (select id from paridad_tiendas);
  delete from public.productos where tienda_id in (select id from paridad_tiendas);
  delete from public.user_tiendas where tienda_id in (select id from paridad_tiendas);
  delete from public.tiendas where id in (select id from paridad_tiendas);
`

async function signIn(stack: LocalStack, email: string): Promise<SupabaseClient> {
  const client = createClient(stack.url, stack.anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD })
  if (error) throw error
  return client
}

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

/** Números a 6 decimales (porcentajes en float vs numeric) y sin los campos que el web no tiene. */
function normalize(value: unknown): unknown {
  if (typeof value === 'number') return Math.round(value * 1e6) / 1e6
  if (Array.isArray(value)) return value.map(normalize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !['from', 'to', 'timezone', 'cashier_email'].includes(key))
        .map(([key, v]) => [key, normalize(v)])
    )
  }
  return value
}

describe('owner_sales_summary: paridad con el reporte del POS web', () => {
  let stack: LocalStack
  let admin: SupabaseClient
  let cashier: SupabaseClient
  const userIds: string[] = []
  const adminEmail = `paridad-admin-${TIENDA.slice(0, 8)}@local.test`
  const cashierEmail = `paridad-cajero-${TIENDA.slice(0, 8)}@local.test`

  beforeAll(async () => {
    stack = localStack()
    const service = createClient(stack.url, stack.serviceRoleKey, { auth: { persistSession: false } })
    const ids: { admin?: string; cajero?: string } = {}
    for (const [key, email] of [['admin', adminEmail], ['cajero', cashierEmail]] as const) {
      const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
      if (error) throw error
      ids[key] = data.user.id
      userIds.push(data.user.id)
    }
    psql(stack, CLEANUP_SQL)
    psql(stack, readFileSync(path.join(__dirname, 'fixtures/owner-sales-summary.sql'), 'utf8'), {
      tienda: TIENDA,
      otra: OTRA,
      admin: ids.admin ?? '',
      cajero: ids.cajero ?? '',
    })
    admin = await signIn(stack, adminEmail)
    cashier = await signIn(stack, cashierEmail)
  })

  afterAll(async () => {
    if (!stack) return
    psql(stack, CLEANUP_SQL)
    const service = createClient(stack.url, stack.serviceRoleKey, { auth: { persistSession: false } })
    for (const id of userIds) await service.auth.admin.deleteUser(id)
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
    expect(normalize(data)).toEqual(normalize(toRpcShape(await webSummary(admin, from, to))))
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
