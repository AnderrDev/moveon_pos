import type { ProductType } from '@/shared/types'
import { tracksOwnStock } from '@/shared/lib/product-type'

/**
 * Lista de compras sugerida. Servicio de dominio puro.
 *
 * 1. Consumo diario estimado por producto (ventas reales, incluidos los
 *    componentes que consumen batidos y combos — vienen de `sale_exit`):
 *      0,6 × promedio de los últimos 14 días + 0,4 × promedio de 56 días.
 *    Pondera lo reciente sin olvidar la tendencia. Un producto con menos
 *    historia usa los días que lleva, con un mínimo de 7 para que unos pocos
 *    días de arranque no disparen el pronóstico.
 * 2. Objetivo = consumo × días de cobertura (nunca menos que el stock mínimo).
 *    Sugerido = objetivo − stock actual (bodega + punto de venta), redondeado
 *    hacia arriba.
 * 3. Prioridad: lo que antes se agota (días que alcanza el stock); a igual
 *    urgencia, lo que más margen deja por día.
 * 4. Presupuesto: se llena en orden de prioridad. Si un producto no cabe
 *    completo se compra lo que alcance (mínimo una unidad); si no alcanza ni
 *    una, queda "fuera del presupuesto". Nunca se pasa del presupuesto.
 */

export const RECENT_DAYS = 14
export const HISTORY_DAYS = 56
const RECENT_WEIGHT = 0.6
const MIN_HISTORY_DAYS = 7

export interface PurchaseProductInput {
  id: string
  nombre: string
  tipo: ProductType
  costo: number | null
  precioVenta: number
  stockMinimo: number
  proveedorNombre: string | null
  /** Fecha de creación: limita los días de historia de productos nuevos. */
  createdAt: Date
}

/** Consumo neto (unidades) de un producto en un instante. */
export interface ConsumptionRecord {
  productId: string
  unidades: number
  at: Date
}

export interface PurchaseOptions {
  /** Días que debe alcanzar el stock después de comprar. */
  coverDays: number
  /** Dinero disponible para la compra; `null` = sin tope. */
  budget: number | null
  now: Date
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
  /** Unidades necesarias para cubrir los días pedidos. */
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

const DAY_MS = 24 * 60 * 60 * 1000

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

export function estimateDailyConsumption(
  records: readonly Pick<ConsumptionRecord, 'unidades' | 'at'>[],
  createdAt: Date,
  now: Date,
): number {
  const ageDays = Math.max(MIN_HISTORY_DAYS, Math.ceil((now.getTime() - createdAt.getTime()) / DAY_MS))
  const recentDays = Math.min(RECENT_DAYS, ageDays)
  const historyDays = Math.min(HISTORY_DAYS, ageDays)
  let recent = 0
  let history = 0
  for (const r of records) {
    const age = (now.getTime() - r.at.getTime()) / DAY_MS
    if (age < 0 || age >= historyDays) continue
    history += r.unidades
    if (age < recentDays) recent += r.unidades
  }
  const daily = RECENT_WEIGHT * (Math.max(recent, 0) / recentDays) + (1 - RECENT_WEIGHT) * (Math.max(history, 0) / historyDays)
  return daily
}

export function buildPurchasePlan(
  products: readonly PurchaseProductInput[],
  stockByProduct: ReadonlyMap<string, number>,
  consumption: readonly ConsumptionRecord[],
  options: PurchaseOptions,
): PurchasePlan {
  const byProduct = new Map<string, ConsumptionRecord[]>()
  for (const record of consumption) {
    const list = byProduct.get(record.productId)
    if (list) list.push(record)
    else byProduct.set(record.productId, [record])
  }

  const candidates = products
    .filter((p) => tracksOwnStock(p.tipo))
    .map((p) => {
      const stockActual = Math.max(stockByProduct.get(p.id) ?? 0, 0)
      const consumoDiario = estimateDailyConsumption(byProduct.get(p.id) ?? [], p.createdAt, options.now)
      const objetivo = Math.max(consumoDiario * options.coverDays, consumoDiario > 0 ? p.stockMinimo : 0)
      const necesario = Math.max(0, Math.ceil(objetivo - stockActual - 1e-9))
      const diasQueAlcanza = consumoDiario > 0 ? stockActual / consumoDiario : null
      const margenDiario = p.costo !== null ? (p.precioVenta - p.costo) * consumoDiario : 0
      return { p, stockActual, consumoDiario, necesario, diasQueAlcanza, margenDiario }
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
