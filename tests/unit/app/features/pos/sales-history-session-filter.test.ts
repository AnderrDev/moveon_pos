import { describe, it, expect } from 'vitest'
// Función pura extraída del dialog para correr en node sin TestBed ni Supabase.
import { selectSessionSales } from '../../../../../apps/pos-angular/src/app/features/pos/sales-history.session-filter'
import type { Sale } from '@/modules/sales/domain/entities/sale.entity'

function makeSale(id: string, cashSessionId: string): Sale {
  return {
    id,
    tiendaId: 'tienda-1',
    cashSessionId,
    saleNumber: id,
    clienteId: null,
    cashierId: 'cashier-1',
    status: 'completed',
    billingStatus: 'pending',
    billingDocumentId: null,
    items: [],
    payments: [],
    subtotal: 0,
    discountTotal: 0,
    taxTotal: 0,
    total: 0,
    change: 0,
    idempotencyKey: `key-${id}`,
    voidedBy: null,
    voidedAt: null,
    voidedReason: null,
    createdAt: new Date('2026-05-27T10:00:00Z'),
    updatedAt: new Date('2026-05-27T10:00:00Z'),
  }
}

describe('selectSessionSales', () => {
  it('devuelve solo las ventas de la sesión pedida cuando hay 2 sesiones', () => {
    const sales = [
      makeSale('a', 'session-1'),
      makeSale('b', 'session-2'),
      makeSale('c', 'session-1'),
    ]

    const result = selectSessionSales(sales, 'session-1')

    expect(result.map((s) => s.id)).toEqual(['a', 'c'])
  })

  it('devuelve [] cuando cashSessionId es null (sin caja abierta)', () => {
    const sales = [makeSale('a', 'session-1'), makeSale('b', 'session-2')]

    expect(selectSessionSales(sales, null)).toEqual([])
  })

  it('devuelve [] cuando la sesión pedida no tiene ventas', () => {
    const sales = [makeSale('a', 'session-1'), makeSale('b', 'session-2')]

    expect(selectSessionSales(sales, 'session-3')).toEqual([])
  })
})
