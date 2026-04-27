'use server'

import { getAuthContext } from '@/shared/lib/auth-context'
import { SupabaseSaleRepository } from '../../infrastructure/repositories/supabase-sale.repository'
import type { Sale } from '../../domain/entities/sale.entity'

export type SessionSaleRow = {
  id: string
  saleNumber: string
  total: number
  status: 'completed' | 'voided'
  payments: { metodo: string; amount: number }[]
  itemCount: number
  createdAt: string
}

export async function listSessionSalesAction(cashSessionId: string): Promise<SessionSaleRow[]> {
  const auth = await getAuthContext()
  if (!auth) return []

  const repo   = new SupabaseSaleRepository()
  const result = await repo.listBySession(cashSessionId, auth.tiendaId)
  if (!result.ok) return []

  return result.value.map((sale: Sale): SessionSaleRow => ({
    id:         sale.id,
    saleNumber: sale.saleNumber,
    total:      sale.total,
    status:     sale.status as 'completed' | 'voided',
    payments:   sale.payments.map((p) => ({ metodo: p.metodo, amount: p.amount })),
    itemCount:  sale.items.reduce((s, i) => s + i.quantity, 0),
    createdAt:  sale.createdAt.toISOString(),
  }))
}
