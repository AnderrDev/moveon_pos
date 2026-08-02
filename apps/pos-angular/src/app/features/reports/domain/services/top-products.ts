/**
 * Servicio de dominio puro (TS, sin Angular/Supabase/DOM).
 *
 * Agrupa las ventas completadas del período por producto (`productId`) para la
 * sección "Top productos" del reporte de ventas (PLAN-39). Replica la
 * semántica de la sección 4 ("PRODUCTOS MÁS VENDIDOS") de
 * `scripts/reports/business-status-report.sql`: solo ventas
 * `status = 'completed'`, `numVentas` cuenta ventas DISTINTAS (no líneas) en
 * las que aparece el producto.
 *
 * SRP estricto: solo agrupa y agrega; NO decide el orden de presentación (esa
 * es responsabilidad de la capa de presentación, ver
 * `top-products-table.component.ts`) ni formatea moneda — mismo criterio que
 * `sales-trend.ts` y `group-sales-by-cashier.ts`.
 *
 * Solo depende del tipo `Sale` del dominio de ventas; no introduce
 * dependencias.
 */

import type { Sale } from '@angular-app/features/sales/domain/entities/sale.entity'

/** Resumen agregado de ventas completadas de un producto en el período. */
export interface ProductSalesSummary {
  productId: string
  nombre: string
  sku: string | null
  /** Cantidad de ventas DISTINTAS en las que aparece el producto (`count(distinct sale_id)` del SQL de referencia), no cantidad de líneas. */
  numVentas: number
  /** Unidades vendidas (suma de `quantity` de todas las líneas del producto). */
  qty: number
  /** Facturación total (suma de `total` de todas las líneas del producto). */
  total: number
  /** Precio promedio ponderado por cantidad: `total / qty`. */
  avgPrice: number
}

/**
 * Agrupa las ventas completadas del período por `productId`. Las ventas
 * `voided` se excluyen por completo: ningún campo de ningún producto se ve
 * afectado por una línea de una venta anulada.
 *
 * `numVentas` usa un `Set<saleId>` por producto para contar ventas distintas:
 * dos líneas del mismo producto dentro de la misma venta (ej. agregado dos
 * veces al carrito) cuentan como 1 venta, no 2 — aunque sí suman ambas a
 * `qty`/`total`.
 *
 * `avgPrice` es `total / qty` (promedio ponderado por cantidad): un promedio
 * simple de `unitPrice` por línea distorsiona el precio efectivo cuando las
 * cantidades vendidas a cada precio difieren mucho entre sí.
 *
 * Orden determinista por defecto: `total` descendente (mismo criterio que el
 * `ORDER BY total_facturado DESC` del SQL de referencia y que el sort previo
 * de `productSales` en `reports.service.ts`); en empate, por `productId`
 * ascendente. El orden de presentación (por unidades o por facturación) es
 * responsabilidad del componente — este servicio solo entrega un orden base
 * estable.
 *
 * @param sales Ventas del período (completadas y anuladas).
 * @returns Un resumen por producto, ordenado de forma determinista.
 */
export function groupSalesByProduct(sales: Sale[]): ProductSalesSummary[] {
  interface Accumulator {
    nombre: string
    sku: string | null
    saleIds: Set<string>
    qty: number
    total: number
  }

  const byProduct = new Map<string, Accumulator>()

  for (const sale of sales) {
    if (sale.status !== 'completed') continue

    for (const item of sale.items) {
      const current = byProduct.get(item.productId) ?? {
        nombre: item.productoNombre,
        sku: item.productoSku,
        saleIds: new Set<string>(),
        qty: 0,
        total: 0,
      }

      current.saleIds.add(sale.id)
      current.qty += item.quantity
      current.total += item.total

      byProduct.set(item.productId, current)
    }
  }

  return Array.from(byProduct.entries())
    .map(([productId, v]) => ({
      productId,
      nombre: v.nombre,
      sku: v.sku,
      numVentas: v.saleIds.size,
      qty: v.qty,
      total: v.total,
      avgPrice: v.qty > 0 ? Math.round((v.total / v.qty) * 100) / 100 : 0,
    }))
    .sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total
      return a.productId.localeCompare(b.productId)
    })
}
