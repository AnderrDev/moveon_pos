/**
 * Servicio de dominio puro (TS, sin Angular/Supabase/DOM).
 *
 * Agrupa las ventas del día por cajero (`cashierId`) y agrega métricas por
 * cajero para el reporte diario. SRP estricto: solo agrupa y agrega; NO formatea
 * ni resuelve nombres de cajero (no hay fuente RLS-safe disponible — `user_tiendas`
 * no tiene nombre y `auth.users` es inaccesible desde el cliente). La resolución
 * de etiqueta visible es responsabilidad de la capa de presentación.
 *
 * Solo depende del tipo `Sale` del dominio de ventas; no introduce dependencias.
 */

import type { Sale } from '@angular-app/features/sales/domain/entities/sale.entity'

/** Resumen agregado de ventas de un cajero en el día. */
export interface CashierSalesSummary {
  /** Identificador del cajero (`Sale.cashierId`). */
  cashierId: string
  /** Cantidad de ventas completadas. */
  countCompleted: number
  /** Cantidad de ventas anuladas. */
  countVoided: number
  /** Total vendido (solo ventas completadas). */
  totalVentas: number
  /** IVA total (solo ventas completadas). */
  taxTotal: number
}

/**
 * Agrupa las ventas por `cashierId`. Las ventas completadas suman a
 * `totalVentas`/`taxTotal` y a `countCompleted`; las anuladas solo incrementan
 * `countVoided` (NO suman al total ni al IVA). Un mismo cajero con ventas
 * completadas y anuladas produce UN solo grupo acumulando ambos conteos.
 *
 * Orden determinista: por `totalVentas` descendente; en empate, por `cashierId`
 * ascendente.
 *
 * @param sales Ventas del día (completadas y anuladas).
 * @returns Un resumen por cajero, ordenado de forma determinista.
 */
export function groupSalesByCashier(sales: Sale[]): CashierSalesSummary[] {
  const byCashier = new Map<string, CashierSalesSummary>()

  for (const sale of sales) {
    const current = byCashier.get(sale.cashierId) ?? {
      cashierId: sale.cashierId,
      countCompleted: 0,
      countVoided: 0,
      totalVentas: 0,
      taxTotal: 0,
    }

    if (sale.status === 'completed') {
      current.countCompleted += 1
      current.totalVentas += sale.total
      current.taxTotal += sale.taxTotal
    } else if (sale.status === 'voided') {
      current.countVoided += 1
    }

    byCashier.set(sale.cashierId, current)
  }

  return Array.from(byCashier.values()).sort((a, b) => {
    if (b.totalVentas !== a.totalVentas) return b.totalVentas - a.totalVentas
    return a.cashierId.localeCompare(b.cashierId)
  })
}
