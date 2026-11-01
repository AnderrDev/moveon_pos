import { describe, expect, it } from 'vitest'
import {
  buildDemandHistories,
  buildPurchasePlan,
  DEFAULT_FORECAST,
  forecastDemand,
  unitsNeeded,
  type DemandForecastOptions,
  type DemandHistory,
  type PurchaseProductInput,
  groupPurchaseLines,
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

describe('agrupar por familia (PLAN-112)', () => {
  it('junta los sabores de una familia con su total y deja sueltos los demás', () => {
    const stock = new Map([
      ['vainilla', 2],
      ['chocolate', 10],
      ['creatina', 1],
    ])
    const histories = new Map([
      ['vainilla', series(days(56, 1))],
      ['chocolate', series(days(56, 1))],
      ['creatina', series(days(56, 1))],
    ])
    const plan = buildPurchasePlan(
      [
        product('vainilla', { nombre: 'WHEY VAINILLA 2LB', familia: 'WHEY 2LB', sabor: 'Vainilla', proveedorNombre: 'Suplecol' }),
        product('chocolate', { nombre: 'WHEY CHOCOLATE 2LB', familia: 'whey 2lb', sabor: 'Chocolate', proveedorNombre: 'Suplecol' }),
        product('creatina', { nombre: 'CREATINA 100', proveedorNombre: 'Healthy' }),
      ],
      stock,
      histories,
      { coverDays: 14, budget: null, forecast: PLAIN },
    )
    const groups = groupPurchaseLines(plan.lines)
    // La creatina es la más urgente (1 día de stock) y va primera; la familia sale en el orden de su primer sabor.
    expect(groups.map((g) => g.key)).toEqual(['prod:creatina', 'fam:whey 2lb'])
    const whey = groups[1]
    expect(whey.familia).toBe('WHEY 2LB')
    expect(whey.lines.map((l) => l.sabor)).toEqual(['Vainilla', 'Chocolate'])
    expect(whey.stockActual).toBe(12)
    expect(whey.consumoDiario).toBe(2)
    expect(whey.diasQueAlcanza).toBe(6)
    expect(whey.necesario).toBe(12 + 4)
    expect(whey.sugerido).toBe(16)
    expect(whey.subtotal).toBe(160_000)
    expect(whey.proveedorNombre).toBe('Suplecol')
  })

  it('un producto sin familia es su propio grupo', () => {
    const groups = groupPurchaseLines([
      { productId: 'a', nombre: 'A', proveedorNombre: null, familia: null, sabor: null, stockActual: 0, consumoDiario: 0, diasQueAlcanza: null, necesario: 1, sugerido: 1, costoUnitario: 100, subtotal: 100, status: 'full' },
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0].familia).toBeNull()
    expect(groups[0].diasQueAlcanza).toBeNull()
  })
})
