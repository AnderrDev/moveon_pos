import type { ProductType } from '@/shared/types'
import { tracksOwnStock } from '@/shared/lib/product-type'
import { storeDateIso, shiftIsoDate } from '@/shared/lib/day-range'

/**
 * Asesor de compras. Servicio de dominio puro (lo usan la página
 * `/finanzas/compras` y el backtest `tests/backtest/purchase-advisor.backtest.ts`).
 *
 * 1. Historia diaria por producto (últimos 56 días, fecha local de la tienda):
 *    consumo por ventas (`sale_exit` − `void_return`, incluye componentes de
 *    batidos y combos) y stock al cierre de cada día.
 * 2. Pronóstico (`forecastDemand`): promedio ponderado de lo reciente y lo
 *    histórico, SIN los días que el producto cerró agotado (ese día la venta
 *    no muestra la demanda real), más la desviación diaria para el colchón
 *    de seguridad. Tendencia y regla de producto joven son opcionales. Los
 *    parámetros por defecto salen del backtest contra el seed masivo local.
 * 3. Necesario = ⌈consumo × días + colchón (z·σ·√días), nunca menos que el
 *    stock mínimo − stock actual⌉.
 * 4. Prioridad: lo que antes se agota; a igual urgencia, mayor margen diario.
 * 5. Presupuesto: se llena en orden; completo, parcial o "sin presupuesto".
 *    Nunca se supera.
 */

export interface DemandForecastOptions {
  recentDays: number
  historyDays: number
  /** Peso del promedio reciente (el resto, del histórico). */
  recentWeight: number
  /** Con menos días válidos se promedia sobre este mínimo (evita picos de arranque). */
  minHistoryDays: number
  /** Excluye los días que cerraron con stock ≤ 0 (demanda censurada). */
  censorStockouts: boolean
  /** Ajusta por la tendencia de las últimas semanas. */
  trend: boolean
  /** Cambio mínimo (|ratio − 1|) para aplicar la tendencia; por debajo es ruido. */
  trendThreshold: number
  /** Fracción del cambio de tendencia que se aplica (amortiguación). */
  trendDamping: number
  /**
   * Producto joven (menos días válidos que esto): se usan solo sus últimos 7
   * días válidos, porque los primeros días de un lanzamiento venden menos.
   */
  youngProductDays: number
  /** Desviaciones estándar de colchón de seguridad (0 = sin colchón). */
  safetyZ: number
}

/**
 * Elegidos con el backtest contra el seed masivo local (2026-10-24, ver
 * docs/modules/expenses.md "Asesor de compras"): excluir días agotados y un
 * colchón de 1σ dan el mejor resultado; la tendencia solo ayuda a productos
 * en alza y en conjunto no mejora, así que queda apagada.
 */
export const DEFAULT_FORECAST: DemandForecastOptions = {
  recentDays: 14,
  historyDays: 56,
  recentWeight: 0.6,
  minHistoryDays: 7,
  censorStockouts: true,
  trend: false,
  trendThreshold: 0.2,
  trendDamping: 0.5,
  youngProductDays: 0,
  safetyZ: 1,
}

export const HISTORY_DAYS = DEFAULT_FORECAST.historyDays

/** Serie diaria de un producto, del día más antiguo al más reciente. */
export interface DemandHistory {
  consumption: readonly number[]
  stockEnd: readonly number[]
}

export interface DemandForecast {
  /** Unidades por día esperadas. */
  daily: number
  /** Desviación estándar diaria (días válidos). */
  sigma: number
  /** Días usados (sin agotados ni antes del lanzamiento). */
  validDays: number
}

function mean(values: readonly number[], minDays = 1): number {
  if (values.length === 0) return 0
  return values.reduce((s, v) => s + v, 0) / Math.max(values.length, minDays)
}

export function forecastDemand(history: DemandHistory, options: DemandForecastOptions): DemandForecast {
  const n = history.consumption.length
  const valid: { i: number; v: number }[] = []
  for (let i = Math.max(0, n - options.historyDays); i < n; i++) {
    const stockout = options.censorStockouts && history.stockEnd[i] <= 0
    if (!stockout) valid.push({ i, v: Math.max(history.consumption[i], 0) })
  }
  if (valid.length === 0) return { daily: 0, sigma: 0, validDays: 0 }

  // Net de devoluciones: suma neta de la ventana (una anulación resta).
  const netTotal = valid.reduce((s, d) => s + history.consumption[d.i], 0)
  if (netTotal <= 0) return { daily: 0, sigma: 0, validDays: valid.length }

  const recentFrom = n - options.recentDays
  const recent = valid.filter((d) => d.i >= recentFrom).map((d) => history.consumption[d.i])
  const all = valid.map((d) => history.consumption[d.i])
  const recentAvg = Math.max(mean(recent, Math.min(options.minHistoryDays, options.recentDays)), 0)
  const histAvg = Math.max(mean(all, options.minHistoryDays), 0)
  let daily = recent.length > 0 ? options.recentWeight * recentAvg + (1 - options.recentWeight) * histAvg : histAvg

  if (valid.length < options.youngProductDays) {
    daily = Math.max(mean(valid.slice(-7).map((d) => d.v)), 0)
  } else if (options.trend && valid.length >= 21) {
    // Mitad reciente vs mitad anterior de los días válidos; amortiguado,
    // acotado y solo si el cambio supera el umbral.
    const half = Math.floor(valid.length / 2)
    const older = mean(valid.slice(0, half).map((d) => d.v))
    const newer = mean(valid.slice(half).map((d) => d.v))
    if (older > 0) {
      const ratio = Math.min(1.6, Math.max(0.6, newer / older))
      if (Math.abs(ratio - 1) >= options.trendThreshold) daily *= 1 + options.trendDamping * (ratio - 1)
    }
  }

  const avg = mean(valid.map((d) => d.v))
  const variance = valid.reduce((s, d) => s + (d.v - avg) ** 2, 0) / valid.length
  return { daily, sigma: Math.sqrt(variance), validDays: valid.length }
}

// ---------------- Historia desde movimientos ----------------

/** Movimiento de inventario de cualquier tipo (cantidad con signo). */
export interface StockMovementRecord {
  productId: string
  tipo: string
  cantidad: number
  at: Date
}

/**
 * Arma la historia diaria (fecha local) de cada producto con los movimientos
 * desde `fromDay` y el stock actual: el stock al cierre de un día es el
 * actual menos todo lo que entró/salió después.
 */
export function buildDemandHistories(
  movements: readonly StockMovementRecord[],
  currentStock: ReadonlyMap<string, number>,
  options: { now: Date; timezone: string; days: number; firstDayByProduct?: ReadonlyMap<string, string> },
): Map<string, DemandHistory> {
  const today = storeDateIso(options.now, options.timezone)
  const firstDay = shiftIsoDate(today, -options.days)
  const dayIndex = (iso: string) => {
    const diff = (Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${firstDay}T00:00:00Z`)) / 86_400_000
    return Math.round(diff)
  }

  const consumption = new Map<string, number[]>()
  const net = new Map<string, number[]>()
  const ensure = (id: string) => {
    if (!consumption.has(id)) {
      consumption.set(id, new Array(options.days).fill(0))
      net.set(id, new Array(options.days + 1).fill(0)) // último índice = hoy
    }
  }
  for (const id of currentStock.keys()) ensure(id)

  for (const m of movements) {
    const i = dayIndex(storeDateIso(m.at, options.timezone))
    if (i < 0 || i > options.days) continue
    ensure(m.productId)
    net.get(m.productId)![i] += m.cantidad
    if (i < options.days && (m.tipo === 'sale_exit' || m.tipo === 'void_return')) {
      consumption.get(m.productId)![i] += -m.cantidad
    }
  }

  const histories = new Map<string, DemandHistory>()
  for (const [id, cons] of consumption) {
    const moves = net.get(id)!
    const stockEnd = new Array(options.days).fill(0)
    let stock = currentStock.get(id) ?? 0
    stock -= moves[options.days] // lo de hoy no cuenta en la historia
    for (let i = options.days - 1; i >= 0; i--) {
      stockEnd[i] = stock
      stock -= moves[i]
    }
    // Días antes del lanzamiento no son historia.
    const first = options.firstDayByProduct?.get(id)
    const start = first ? Math.max(0, dayIndex(first)) : 0
    histories.set(id, { consumption: cons.slice(start), stockEnd: stockEnd.slice(start) })
  }
  return histories
}

// ---------------- Plan de compra ----------------

export interface PurchaseProductInput {
  id: string
  nombre: string
  tipo: ProductType
  costo: number | null
  precioVenta: number
  stockMinimo: number
  proveedorNombre: string | null
}

export interface PurchaseOptions {
  /** Días que debe alcanzar el stock después de comprar. */
  coverDays: number
  /** Dinero disponible para la compra; `null` = sin tope. */
  budget: number | null
  forecast?: DemandForecastOptions
}

export type PurchaseLineStatus = 'full' | 'partial' | 'over_budget' | 'no_cost'

export interface PurchaseLine {
  productId: string
  nombre: string
  proveedorNombre: string | null
  stockActual: number
  consumoDiario: number
  /** Días que alcanza el stock actual (`null` si no hay consumo). */
  diasQueAlcanza: number | null
  /** Unidades necesarias para cubrir los días pedidos (con colchón). */
  necesario: number
  /** Unidades que entran en el presupuesto. */
  sugerido: number
  costoUnitario: number | null
  subtotal: number
  status: PurchaseLineStatus
}

export interface PurchasePlan {
  lines: PurchaseLine[]
  total: number
  /** Costo de todo lo necesario, quepa o no en el presupuesto. */
  totalNecesario: number
  budget: number | null
  restante: number | null
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/** Unidades a comprar para cubrir `coverDays` con colchón, sin bajar del mínimo. */
export function unitsNeeded(
  forecast: DemandForecast,
  stock: number,
  stockMinimo: number,
  coverDays: number,
  safetyZ: number,
): number {
  if (forecast.daily <= 0) return 0
  const target = Math.max(
    forecast.daily * coverDays + safetyZ * forecast.sigma * Math.sqrt(coverDays),
    stockMinimo,
  )
  return Math.max(0, Math.ceil(target - Math.max(stock, 0) - 1e-9))
}

export function buildPurchasePlan(
  products: readonly PurchaseProductInput[],
  stockByProduct: ReadonlyMap<string, number>,
  histories: ReadonlyMap<string, DemandHistory>,
  options: PurchaseOptions,
): PurchasePlan {
  const forecastOptions = options.forecast ?? DEFAULT_FORECAST
  const empty: DemandHistory = { consumption: [], stockEnd: [] }

  const candidates = products
    .filter((p) => tracksOwnStock(p.tipo))
    .map((p) => {
      const stockActual = Math.max(stockByProduct.get(p.id) ?? 0, 0)
      const forecast = forecastDemand(histories.get(p.id) ?? empty, forecastOptions)
      const necesario = unitsNeeded(forecast, stockActual, p.stockMinimo, options.coverDays, forecastOptions.safetyZ)
      const diasQueAlcanza = forecast.daily > 0 ? stockActual / forecast.daily : null
      const margenDiario = p.costo !== null ? (p.precioVenta - p.costo) * forecast.daily : 0
      return { p, stockActual, consumoDiario: forecast.daily, necesario, diasQueAlcanza, margenDiario }
    })
    .filter((c) => c.necesario > 0)
    .sort((a, b) => {
      const da = a.diasQueAlcanza ?? Number.POSITIVE_INFINITY
      const db = b.diasQueAlcanza ?? Number.POSITIVE_INFINITY
      if (da !== db) return da - db
      return b.margenDiario - a.margenDiario
    })

  let restante = options.budget
  let total = 0
  let totalNecesario = 0
  const lines: PurchaseLine[] = candidates.map((c) => {
    const base = {
      productId: c.p.id,
      nombre: c.p.nombre,
      proveedorNombre: c.p.proveedorNombre,
      stockActual: c.stockActual,
      consumoDiario: round1(c.consumoDiario),
      diasQueAlcanza: c.diasQueAlcanza === null ? null : round1(c.diasQueAlcanza),
      necesario: c.necesario,
      costoUnitario: c.p.costo,
    }
    if (c.p.costo === null || c.p.costo <= 0) {
      return { ...base, sugerido: 0, subtotal: 0, status: 'no_cost' as const }
    }
    totalNecesario += c.necesario * c.p.costo
    let sugerido = c.necesario
    if (restante !== null) {
      sugerido = Math.min(c.necesario, Math.floor(restante / c.p.costo))
    }
    const subtotal = sugerido * c.p.costo
    total += subtotal
    if (restante !== null) restante -= subtotal
    const status: PurchaseLineStatus =
      sugerido === c.necesario ? 'full' : sugerido > 0 ? 'partial' : 'over_budget'
    return { ...base, sugerido, subtotal, status }
  })

  return { lines, total, totalNecesario, budget: options.budget, restante }
}
