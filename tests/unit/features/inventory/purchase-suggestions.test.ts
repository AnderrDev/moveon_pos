import { describe, expect, it } from 'vitest'
import {
  buildPurchasePlan,
  estimateDailyConsumption,
  type ConsumptionRecord,
  type PurchaseProductInput,
} from '@angular-app/features/inventory/domain/services/purchase-suggestions'

const NOW = new Date('2026-10-24T20:00:00Z')
const day = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000)

function product(id: string, overrides: Partial<PurchaseProductInput> = {}): PurchaseProductInput {
  return {
    id,
    nombre: id,
    tipo: 'simple',
    costo: 10_000,
    precioVenta: 15_000,
    stockMinimo: 0,
    proveedorNombre: null,
    createdAt: day(200),
    ...overrides,
  }
}

/** `unidades` cada día durante `days` días. */
function daily(productId: string, unidades: number, days: number, offset = 0): ConsumptionRecord[] {
  return Array.from({ length: days }, (_, i) => ({ productId, unidades, at: day(offset + i + 0.5) }))
}

describe('consumo diario estimado', () => {
  it('pondera más las últimas dos semanas', () => {
    // 2/día las últimas 2 semanas, 0 antes: 0,6×2 + 0,4×(28/56)
    expect(estimateDailyConsumption(daily('a', 2, 14), day(200), NOW)).toBeCloseTo(1.2 + 0.4 * 0.5)
  })

  it('un producto nuevo usa solo los días que lleva', () => {
    expect(estimateDailyConsumption(daily('a', 3, 10), day(10), NOW)).toBeCloseTo(3)
  })

  it('con menos de 7 días de historia promedia sobre 7', () => {
    // 6 unidades en 2 días de vida: 6/7 en vez de 3/día
    expect(estimateDailyConsumption(daily('a', 3, 2), day(2), NOW)).toBeCloseTo(6 / 7)
  })

  it('las devoluciones por anulación restan', () => {
    const records = [...daily('a', 1, 56), { productId: 'a', unidades: -56, at: day(1) }]
    expect(estimateDailyConsumption(records, day(200), NOW)).toBe(0)
  })
})

describe('lista de compras', () => {
  const consumption = [...daily('rapido', 2, 56), ...daily('lento', 0.5, 56), ...daily('sobrado', 1, 56)]
  const stock = new Map([
    ['rapido', 4],
    ['lento', 2],
    ['sobrado', 100],
  ])

  it('sugiere lo necesario para cubrir los días, primero lo que antes se agota', () => {
    const plan = buildPurchasePlan(
      [product('lento'), product('rapido'), product('sobrado')],
      stock,
      consumption,
      { coverDays: 14, budget: null, now: NOW },
    )
    expect(plan.lines.map((l) => [l.productId, l.necesario, l.diasQueAlcanza])).toEqual([
      ['rapido', 24, 2], // 2/día × 14 − 4
      ['lento', 5, 4], // 0,5 × 14 − 2
    ])
    expect(plan.total).toBe(29 * 10_000)
  })

  it('nunca se pasa del presupuesto: completa, parcial y fuera', () => {
    const plan = buildPurchasePlan([product('rapido'), product('lento')], stock, consumption, {
      coverDays: 14,
      budget: 250_000,
      now: NOW,
    })
    expect(plan.lines.map((l) => [l.productId, l.sugerido, l.status])).toEqual([
      ['rapido', 24, 'full'],
      ['lento', 1, 'partial'],
    ])
    expect(plan.total).toBe(250_000)
    expect(plan.restante).toBe(0)

    const tight = buildPurchasePlan([product('rapido')], stock, consumption, { coverDays: 14, budget: 5_000, now: NOW })
    expect(tight.lines[0]).toMatchObject({ sugerido: 0, status: 'over_budget', subtotal: 0 })
    expect(tight.total).toBe(0)
  })

  it('preparados y combos no entran; sin costo no consume presupuesto', () => {
    const plan = buildPurchasePlan(
      [product('rapido', { costo: null }), product('lento', { tipo: 'prepared' })],
      stock,
      consumption,
      { coverDays: 14, budget: 100_000, now: NOW },
    )
    expect(plan.lines).toHaveLength(1)
    expect(plan.lines[0]).toMatchObject({ productId: 'rapido', status: 'no_cost', sugerido: 0 })
    expect(plan.restante).toBe(100_000)
  })

  it('respeta el stock mínimo cuando el producto se vende', () => {
    const plan = buildPurchasePlan([product('lento', { stockMinimo: 10 })], stock, consumption, {
      coverDays: 7,
      budget: null,
      now: NOW,
    })
    expect(plan.lines[0].necesario).toBe(8) // máx(0,5×7; 10) − 2
  })
})
