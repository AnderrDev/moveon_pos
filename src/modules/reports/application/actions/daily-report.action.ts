'use server'

import { getAuthContext } from '@/shared/lib/auth-context'
import { SupabaseSaleRepository } from '@/modules/sales/infrastructure/repositories/supabase-sale.repository'
import { SupabaseCashRegisterRepository } from '@/modules/cash-register/infrastructure/repositories/supabase-cash-register.repository'
import type { Sale } from '@/modules/sales/domain/entities/sale.entity'

export type PaymentBreakdown = { metodo: string; count: number; total: number }
export type TopProduct = { productId: string; nombre: string; qty: number; total: number }

export type DailyReport = {
  date: string
  totalVentas: number
  countVentas: number
  countAnuladas: number
  taxTotal: number
  discountTotal: number
  avgVenta: number
  paymentBreakdown: PaymentBreakdown[]
  topProducts: TopProduct[]
  sessions: { id: string; openedAt: string; closedAt: string | null; expectedAmount: number }[]
}

export async function getDailyReportAction(dateStr: string): Promise<DailyReport | null> {
  const auth = await getAuthContext()
  if (!auth) return null

  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return null

  const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0)
  const dayEnd   = new Date(date); dayEnd.setHours(23, 59, 59, 999)

  const [salesResult, sessionsResult] = await Promise.all([
    new SupabaseSaleRepository().listByDate(auth.tiendaId, date),
    new SupabaseCashRegisterRepository().listSessions(auth.tiendaId, 50),
  ])

  const allSales = salesResult.ok ? salesResult.value : []
  const sessions = sessionsResult.ok
    ? sessionsResult.value.filter((s) => s.openedAt >= dayStart && s.openedAt <= dayEnd)
    : []

  const completed = allSales.filter((s: Sale) => s.status === 'completed')
  const voided    = allSales.filter((s: Sale) => s.status === 'voided')

  // Totales
  const totalVentas   = completed.reduce((s, v) => s + v.total, 0)
  const taxTotal      = completed.reduce((s, v) => s + v.taxTotal, 0)
  const discountTotal = completed.reduce((s, v) => s + v.discountTotal, 0)
  const avgVenta      = completed.length > 0 ? Math.round(totalVentas / completed.length) : 0

  // Pagos por método
  const payMap = new Map<string, { count: number; total: number }>()
  for (const sale of completed) {
    for (const p of sale.payments) {
      const cur = payMap.get(p.metodo) ?? { count: 0, total: 0 }
      payMap.set(p.metodo, { count: cur.count + 1, total: cur.total + p.amount })
    }
  }
  const paymentBreakdown: PaymentBreakdown[] = Array.from(payMap.entries())
    .map(([metodo, v]) => ({ metodo, ...v }))
    .sort((a, b) => b.total - a.total)

  // Top 5 productos
  const prodMap = new Map<string, { nombre: string; qty: number; total: number }>()
  for (const sale of completed) {
    for (const item of sale.items) {
      const cur = prodMap.get(item.productId) ?? { nombre: item.productoNombre, qty: 0, total: 0 }
      prodMap.set(item.productId, {
        nombre: cur.nombre,
        qty:    cur.qty + item.quantity,
        total:  cur.total + item.total,
      })
    }
  }
  const topProducts: TopProduct[] = Array.from(prodMap.entries())
    .map(([productId, v]) => ({ productId, ...v }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5)

  return {
    date: dateStr,
    totalVentas,
    countVentas:   completed.length,
    countAnuladas: voided.length,
    taxTotal,
    discountTotal,
    avgVenta,
    paymentBreakdown,
    topProducts,
    sessions: sessions.map((s) => ({
      id:             s.id,
      openedAt:       s.openedAt.toISOString(),
      closedAt:       s.closedAt?.toISOString() ?? null,
      expectedAmount: s.expectedCashAmount ?? 0,
    })),
  }
}
