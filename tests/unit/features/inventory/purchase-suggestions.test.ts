import { describe, expect, it } from 'vitest'
import {
  buildDemandHistories,
  buildPurchasePlan,
  buildReplenishmentPlan,
  DEFAULT_FORECAST,
  forecastDemand,
  unitsNeeded,
  type DemandForecastOptions,
  type DemandHistory,
  type PurchaseProductInput,
} from '@angular-app/features/inventory/domain/services/purchase-suggestions'

/** Sin colchón, para que las cuentas se lean fácil. */
const PLAIN: DemandForecastOptions = { ...DEFAULT_FORECAST, safetyZ: 0 }

function series(consumption: number[], stockEnd?: number[]): DemandHistory {
  return { consumption, stockEnd: stockEnd ?? consumption.map(() => 50) }
}
const days = (n: number, v: number) => new Array(n).fill(v) as number[]

function product(id: string, overrides: Partial<PurchaseProductInput> = {}): PurchaseProductInput {
  return { id, nombre: id, tipo: 'simple', costo: 10_000, precioVenta: 15_000, stockMinimo: 0, proveedorNombre: null, ...overrides }
}

describe('pronóstico de demanda', () => {
  it('pondera más las últimas dos semanas', () => {
    // 0 durante 42 días y 2/día las últimas 14: 0,6×2 + 0,4×(28/56)
    const f = forecastDemand(series([...days(42, 0), ...days(14, 2)]), PLAIN)
    expect(f.daily).toBeCloseTo(1.2 + 0.4 * 0.5)
  })

  it('con menos de 7 días de historia promedia sobre 7', () => {
    expect(forecastDemand(series([3, 3]), PLAIN).daily).toBeCloseTo(6 / 7)
  })

  it('no cuenta los días que cerraron agotados (la venta no muestra la demanda)', () => {
    // Vendía 2/día; 28 días agotado vendiendo 0.
    const history = series([...days(28, 2), ...days(28, 0)], [...days(28, 10), ...days(28, 0)])
    expect(forecastDemand(history, { ...PLAIN, censorStockouts: false }).daily).toBeCloseTo(0.4 * 1)
    expect(forecastDemand(history, PLAIN).daily).toBeCloseTo(2)
  })

  it('las devoluciones por anulación restan', () => {
    expect(forecastDemand(series([...days(55, 1), -55]), PLAIN).daily).toBe(0)
  })

  it('el colchón suma z·σ·√días', () => {
    const f = forecastDemand(series([...days(28, 0), ...days(28, 4)].map((v, i) => (i % 2 ? v : 0))), PLAIN)
    expect(f.sigma).toBeGreaterThan(0)
    expect(unitsNeeded(f, 0, 0, 14, 1)).toBe(Math.ceil(f.daily * 14 + f.sigma * Math.sqrt(14)))
  })

  it('la tendencia (opcional) sube el pronóstico de un producto en alza', () => {
    const rising = series(Array.from({ length: 56 }, (_, i) => (i < 28 ? 1 : 2)))
    const flat = forecastDemand(rising, PLAIN).daily
    expect(forecastDemand(rising, { ...PLAIN, trend: true }).daily).toBeGreaterThan(flat)
  })
})

describe('historia desde movimientos', () => {
  it('arma consumo diario y stock al cierre hacia atrás desde el stock actual', () => {
    const now = new Date('2026-10-24T20:00:00Z') // 15:00 en Bogotá
    const at = (iso: string) => new Date(`${iso}T15:00:00Z`)
    const movements = [
      { productId: 'p', tipo: 'entry', cantidad: 10, at: at('2026-10-21') },
      { productId: 'p', tipo: 'sale_exit', cantidad: -3, at: at('2026-10-22') },
      { productId: 'p', tipo: 'void_return', cantidad: 1, at: at('2026-10-22') },
      { productId: 'p', tipo: 'sale_exit', cantidad: -8, at: at('2026-10-23') },
      { productId: 'p', tipo: 'sale_exit', cantidad: -1, at: at('2026-10-24') }, // hoy: fuera de la historia
    ]
    const h = buildDemandHistories(movements, new Map([['p', 4]]), {
      now,
      timezone: 'America/Bogota',
      days: 4,
    }).get('p')!
    // Días 20, 21, 22, 23 de octubre
    expect(h.consumption).toEqual([0, 0, 2, 8])
    expect(h.stockEnd).toEqual([5, 15, 13, 5])
  })
})

describe('lista de compras', () => {
  const histories = new Map([
    ['rapido', series(days(56, 2))],
    ['lento', series(days(56, 0.5))],
    ['sobrado', series(days(56, 1))],
  ])
  const stock = new Map([
    ['rapido', 4],
    ['lento', 2],
    ['sobrado', 100],
  ])
  const opts = (budget: number | null, coverDays = 14) => ({ coverDays, budget, forecast: PLAIN })

  it('sugiere lo necesario para cubrir los días, primero lo que antes se agota', () => {
    const plan = buildPurchasePlan([product('lento'), product('rapido'), product('sobrado')], stock, histories, opts(null))
    expect(plan.lines.map((l) => [l.productId, l.necesario, l.diasQueAlcanza])).toEqual([
      ['rapido', 24, 2],
      ['lento', 5, 4],
    ])
    expect(plan.total).toBe(29 * 10_000)
  })

  it('nunca se pasa del presupuesto: completa, parcial y fuera', () => {
    const plan = buildPurchasePlan([product('rapido'), product('lento')], stock, histories, opts(250_000))
    expect(plan.lines.map((l) => [l.productId, l.sugerido, l.status])).toEqual([
      ['rapido', 24, 'full'],
      ['lento', 1, 'partial'],
    ])
    expect(plan.total).toBe(250_000)
    expect(plan.restante).toBe(0)

    const tight = buildPurchasePlan([product('rapido')], stock, histories, opts(5_000))
    expect(tight.lines[0]).toMatchObject({ sugerido: 0, status: 'over_budget', subtotal: 0 })
  })

  it('preparados y combos no entran; sin costo no consume presupuesto', () => {
    const plan = buildPurchasePlan(
      [product('rapido', { costo: null }), product('lento', { tipo: 'prepared' })],
      stock,
      histories,
      opts(100_000),
    )
    expect(plan.lines).toHaveLength(1)
    expect(plan.lines[0]).toMatchObject({ productId: 'rapido', status: 'no_cost', sugerido: 0 })
    expect(plan.restante).toBe(100_000)
  })

  it('respeta el stock mínimo cuando el producto se vende', () => {
    const plan = buildPurchasePlan([product('lento', { stockMinimo: 10 })], stock, histories, opts(null, 7))
    expect(plan.lines[0].necesario).toBe(8) // máx(0,5×7; 10) − 2
  })

  it('con el colchón por defecto pide algo más que lo exacto', () => {
    const noisy = new Map([['r', series(Array.from({ length: 56 }, (_, i) => (i % 2 ? 4 : 0)))]])
    const exact = buildPurchasePlan([product('r')], new Map([['r', 0]]), noisy, opts(null)).lines[0].necesario
    const safe = buildPurchasePlan([product('r')], new Map([['r', 0]]), noisy, { coverDays: 14, budget: null }).lines[0].necesario
    expect(safe).toBeGreaterThan(exact)
  })
})

describe('reponer lo vendido (PLAN-114)', () => {
  const now = new Date('2026-11-05T15:00:00Z')
  const at = (daysAgo: number) => new Date(now.getTime() - daysAgo * 86_400_000)
  const prods = [
    product('vitanas', { nombre: 'CREATINA VITANAS', costo: 80_000 }),
    product('whey', { nombre: 'WHEY', costo: 100_000 }),
    product('pase', { nombre: 'PASE 30 SERV', costo: 90_000 }),
  ]
  const movements = [
    // Vitanas: compra hace 10 días, 3 ventas después (1 anulada) → 2 por reponer
    { productId: 'vitanas', tipo: 'entry', cantidad: 5, at: at(10) },
    { productId: 'vitanas', tipo: 'sale_exit', cantidad: -1, at: at(8) },
    { productId: 'vitanas', tipo: 'sale_exit', cantidad: -1, at: at(5) },
    { productId: 'vitanas', tipo: 'sale_exit', cantidad: -1, at: at(2) },
    { productId: 'vitanas', tipo: 'void_return', cantidad: 1, at: at(2) },
    // Whey: vendió 2 hace 20 días, compró 2 hace 3 días → nada pendiente desde la última compra
    { productId: 'whey', tipo: 'sale_exit', cantidad: -2, at: at(20) },
    { productId: 'whey', tipo: 'entry', cantidad: 2, at: at(3) },
    // Pase: sin compras en la historia; 1 tarro abierto para sachets cuenta como vendido
    { productId: 'pase', tipo: 'adjustment', cantidad: -1, at: at(1), referenciaTipo: 'product_split' },
    { productId: 'pase', tipo: 'adjustment', cantidad: -1, at: at(1), referenciaTipo: null },
  ]
  const stock = new Map([['vitanas', 3], ['whey', 4], ['pase', 2]])

  it('desde la última compra: vendido − comprado por producto', () => {
    const plan = buildReplenishmentPlan(prods, stock, movements, { window: 'last_entry', budget: null, now })
    expect(plan.lines.map((l) => [l.productId, l.vendido, l.comprado, l.necesario])).toEqual([
      ['pase', 1, 0, 1],
      ['vitanas', 2, 0, 2],
    ])
    expect(plan.lines[1].desde).toEqual(at(10))
    expect(plan.lines[0].desde).toBeNull()
    expect(plan.total).toBe(90_000 + 160_000)
  })

  it('con ventana de días, lo comprado en la ventana descuenta', () => {
    const plan = buildReplenishmentPlan(prods, stock, movements, { window: 30, budget: null, now })
    // Whey vendió 2 y compró 2; Vitanas vendió 2 y compró 5: ninguno queda pendiente.
    expect(plan.lines.map((l) => l.productId)).toEqual(['pase'])
  })

  it('respeta el presupuesto en orden de menor stock', () => {
    const plan = buildReplenishmentPlan(prods, stock, movements, { window: 'last_entry', budget: 100_000, now })
    expect(plan.lines.map((l) => [l.productId, l.sugerido, l.status])).toEqual([
      ['pase', 1, 'full'],
      ['vitanas', 0, 'over_budget'],
    ])
    expect(plan.restante).toBe(10_000)
  })
})
