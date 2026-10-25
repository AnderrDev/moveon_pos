/**
 * Backtest del asesor de compras contra el seed masivo LOCAL
 * (`scripts/seed-asesor-compras.sql`). No es parte de `pnpm test`:
 *
 *   pnpm seed:asesor && pnpm test:backtest
 *
 * En 12 fechas del pasado (cada 7 días) el pronóstico solo ve lo anterior a
 * la fecha; se compara con la demanda REAL de los 14 días siguientes
 * (`sim.daily_demand`, incluida la perdida por agotado) y se simula la compra
 * sugerida para medir nivel de servicio y dinero que queda sobrando.
 */
import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import {
  buildDemandHistories,
  forecastDemand,
  type DemandForecastOptions,
  DEFAULT_FORECAST,
} from '@angular-app/features/inventory/domain/services/purchase-suggestions'

const DB = process.env['LOCAL_DB_URL'] ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const HORIZON = 14
const EVAL_POINTS = 12

function query(sql: string): string[][] {
  // Fechas en hora de la tienda, igual que el seed.
  const out = execFileSync('psql', [DB, '-At', '-F', '|', '-c', sql], {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    env: { ...process.env, PGTZ: 'America/Bogota' },
  })
  return out
    .split('\n')
    .filter((l) => l.length > 0)
    .map((l) => l.split('|'))
}

interface ProductSeries {
  id: string
  code: string
  perfil: string
  segment: string
  costo: number
  precio: number
  stockMin: number
  firstDay: number
  consumption: number[]
  stockEnd: number[]
  truth: number[]
}

function load(): { products: ProductSeries[]; days: string[] } {
  const days = query(
    `select to_char(d, 'YYYY-MM-DD') from generate_series(current_date - 180, current_date - 1, interval '1 day') d`,
  ).map((r) => r[0])
  const index = new Map(days.map((d, i) => [d, i]))
  const products = query(
    `select s.id, s.code, s.perfil, coalesce(p.costo, s.costo), s.stock_min,
            to_char(p.created_at at time zone 'America/Bogota', 'YYYY-MM-DD'), s.precio,
            case when s.cut_from_ago is not null or s.lead_days >= 10 then 'agotados frecuentes'
                 when s.launch_ago is not null then 'lanzamiento reciente'
                 when s.end_ago is not null then 'descontinuado'
                 when s.tipo = 'ingredient' then 'insumo de batidos'
                 else s.perfil end
     from sim.products s join public.productos p on p.id = s.id
     where s.tipo in ('simple', 'ingredient')`,
  ).map(([id, code, perfil, costo, stockMin, created, precio, segment]) => ({
    id,
    code,
    perfil,
    segment,
    costo: Number(costo),
    precio: Number(precio) > 0 ? Number(precio) : Number(costo) * 3,
    stockMin: Number(stockMin),
    firstDay: Math.max(0, index.get(created) ?? 0),
    consumption: new Array(days.length).fill(0),
    stockEnd: new Array(days.length).fill(0),
    truth: new Array(days.length).fill(0),
  }))
  const byId = new Map(products.map((p) => [p.id, p]))
  const net = new Map(products.map((p) => [p.id, new Array(days.length).fill(0)]))
  for (const [pid, tipo, cantidad, day] of query(
    `select producto_id, tipo, cantidad, to_char(created_at at time zone 'America/Bogota', 'YYYY-MM-DD')
     from public.inventory_movements where producto_id in (select id from sim.products)`,
  )) {
    const p = byId.get(pid)
    const i = index.get(day)
    if (!p || i === undefined) continue
    net.get(pid)![i] += Number(cantidad)
    if (tipo === 'sale_exit' || tipo === 'void_return') p.consumption[i] += -Number(cantidad)
  }
  // El inventario inicial se registra el día anterior al primer día simulado.
  for (const [pid, cantidad] of query(
    `select producto_id, sum(cantidad) from public.inventory_movements
     where producto_id in (select id from sim.products)
       and (created_at at time zone 'America/Bogota')::date < current_date - 180 group by 1`,
  )) {
    net.get(pid)![0] += Number(cantidad)
  }
  for (const p of products) {
    let stock = 0
    const n = net.get(p.id)!
    for (let i = 0; i < days.length; i++) {
      stock += n[i]
      p.stockEnd[i] = stock
    }
  }
  for (const [pid, day, demand] of query(`select producto_id, to_char(day, 'YYYY-MM-DD'), demand from sim.daily_demand`)) {
    const p = byId.get(pid)
    const i = index.get(day)
    if (p && i !== undefined) p.truth[i] = Number(demand)
  }
  return { products, days }
}

interface Metrics {
  name: string
  /** Margen perdido por agotados + 2% del dinero parado en sobrante (por quincena). */
  score: number
  lostMargin: number
  wape: number
  bias: number
  serviceLevel: number
  stockoutLines: number
  leftoverValue: number
  investment: number
}

function evaluate(
  name: string,
  options: DemandForecastOptions,
  data: ReturnType<typeof load>,
  segment?: string,
): Metrics {
  const last = data.days.length
  let absErr = 0
  let err = 0
  let actualSum = 0
  let served = 0
  let stockoutLines = 0
  let leftoverValue = 0
  let investment = 0
  let lostMargin = 0
  for (let k = 0; k < EVAL_POINTS; k++) {
    const t = last - HORIZON - 7 * k // primer día del horizonte
    for (const p of data.products) {
      if (segment && p.segment !== segment) continue
      if (t - p.firstDay < 1) continue
      const from = Math.max(p.firstDay, t - options.historyDays)
      const history = {
        consumption: p.consumption.slice(from, t),
        stockEnd: p.stockEnd.slice(from, t),
      }
      const f = forecastDemand(history, options)
      const actual = p.truth.slice(t, t + HORIZON).reduce((s, v) => s + v, 0)
      const stock = Math.max(p.stockEnd[t - 1], 0)
      const target = Math.max(f.daily * HORIZON + options.safetyZ * f.sigma * Math.sqrt(HORIZON), f.daily > 0 ? p.stockMin : 0)
      const order = Math.max(0, Math.ceil(target - stock - 1e-9))
      const available = stock + order
      absErr += Math.abs(f.daily * HORIZON - actual)
      err += f.daily * HORIZON - actual
      actualSum += actual
      served += Math.min(actual, available)
      if (available < actual) {
        stockoutLines++
        lostMargin += (actual - available) * (p.precio - p.costo)
      }
      leftoverValue += Math.max(0, available - actual) * p.costo
      investment += order * p.costo
    }
  }
  return {
    name,
    score: lostMargin + 0.02 * leftoverValue,
    lostMargin,
    wape: absErr / Math.max(actualSum, 1),
    bias: err / actualSum,
    serviceLevel: served / Math.max(actualSum, 1),
    stockoutLines,
    leftoverValue,
    investment,
  }
}

describe('backtest del asesor de compras (seed local)', () => {
  it('la historia que arma la app desde los movimientos coincide con la del seed', () => {
    const data = load()
    const movements = query(
      `select producto_id, tipo, cantidad, extract(epoch from created_at) from public.inventory_movements
       where producto_id in (select id from sim.products) and created_at >= now() - interval '60 days'`,
    ).map(([productId, tipo, cantidad, epoch]) => ({ productId, tipo, cantidad: Number(cantidad), at: new Date(Number(epoch) * 1000) }))
    const stockNow = new Map(
      query(
        `select l.producto_id, l.bodega_stock + l.punto_venta_stock from get_stock_levels('00000000-0000-0000-0000-000000000001') l
         where l.producto_id in (select id from sim.products)`,
      ).map(([id, qty]) => [id, Number(qty)]),
    )
    const histories = buildDemandHistories(movements, stockNow, { now: new Date(), timezone: 'America/Bogota', days: 56 })
    for (const p of data.products) {
      const h = histories.get(p.id)!
      expect(h.consumption, p.code).toEqual(p.consumption.slice(-56))
      expect(h.stockEnd, p.code).toEqual(p.stockEnd.slice(-56))
    }
  })

  it('compara variantes del pronóstico', () => {
    const data = load()
    expect(data.products.length).toBeGreaterThan(30)

    const base = { ...DEFAULT_FORECAST, trendThreshold: 0, trendDamping: 0.5, youngProductDays: 0 }
    const variants: [string, DemandForecastOptions][] = [
      ['v1 (0,6·14d + 0,4·56d)', { ...base, censorStockouts: false, trend: false, safetyZ: 0 }],
      ['sin días agotados', { ...base, censorStockouts: true, trend: false, safetyZ: 0 }],
      ['+ tendencia sin umbral', { ...base, trend: true, safetyZ: 0 }],
      ['+ tendencia umbral 20%', { ...base, trend: true, trendThreshold: 0.2, safetyZ: 0 }],
      ['+ tendencia umbral 20% ×0,8', { ...base, trend: true, trendThreshold: 0.2, trendDamping: 0.8, safetyZ: 0 }],
      ['+ tendencia umbral 30%', { ...base, trend: true, trendThreshold: 0.3, safetyZ: 0 }],
      ['+ tend. 20% + joven<28d', { ...base, trend: true, trendThreshold: 0.2, youngProductDays: 28, safetyZ: 0 }],
      ['+ tend. 20% + joven<28d + z=1', { ...base, trend: true, trendThreshold: 0.2, youngProductDays: 28, safetyZ: 1 }],
      ['+ tend. 20% + joven<28d + z=1,28', { ...base, trend: true, trendThreshold: 0.2, youngProductDays: 28, safetyZ: 1.28 }],
      ['sin agotados + z=1 (sin tendencia)', { ...base, trend: false, safetyZ: 1 }],
      ['por defecto actual', DEFAULT_FORECAST],
    ]

    const results = variants.map(([name, opts]) => evaluate(name, opts, data))
    const fmt = (n: number) => `${(n * 100).toFixed(1)}%`
    const money = (n: number) => `$${Math.round(n / 1000).toLocaleString('es-CO')}k`
    // eslint-disable-next-line no-console
    console.table(
      results.map((r) => ({
        variante: r.name,
        'error (WAPE)': fmt(r.wape),
        sesgo: fmt(r.bias),
        'nivel de servicio': fmt(r.serviceLevel),
        'casos con agotado': r.stockoutLines,
        'sobrante al costo': money(r.leftoverValue),
        'compra total': money(r.investment),
        'margen perdido': money(r.lostMargin),
        puntaje: money(r.score),
      })),
    )

    // Desglose por tipo de producto: dónde ayuda cada ajuste.
    const segments = [...new Set(data.products.map((p) => p.segment))].sort()
    const compare: [string, DemandForecastOptions][] = [variants[1], variants[2], variants[3], variants[6], variants[7]]
    // eslint-disable-next-line no-console
    console.table(
      segments.flatMap((segment) =>
        compare.map(([name, opts]) => {
          const r = evaluate(name, opts, data, segment)
          return {
            segmento: segment,
            variante: name,
            'error (WAPE)': fmt(r.wape),
            sesgo: fmt(r.bias),
            servicio: fmt(r.serviceLevel),
            puntaje: money(r.score),
          }
        }),
      ),
    )

    const chosen = results[results.length - 1]
    expect(chosen.serviceLevel).toBeGreaterThan(0.9)
    expect(chosen.wape).toBeLessThan(0.5)
  })
})
