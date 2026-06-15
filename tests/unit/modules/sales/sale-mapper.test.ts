import { describe, expect, it } from 'vitest'
import { rowToSale, type SaleRow } from '@/modules/sales/infrastructure/mappers/sale.mapper'

function makeRow(overrides: Partial<SaleRow> = {}): SaleRow {
  return {
    id: 'sale-1',
    tienda_id: 'store-1',
    cash_session_id: 'session-1',
    sale_number: 'V-000001',
    cliente_id: 'client-1',
    cashier_id: 'cashier-1',
    cashier_email: 'cajero@example.com',
    subtotal: 80_000,
    item_discount_total: 0,
    global_discount_total: 0,
    discount_total: 0,
    discount_reason: null,
    discount_approved_by: null,
    tax_total: 12_773,
    total: 80_000,
    status: 'completed',
    billing_status: 'not_required',
    billing_document_id: null,
    voided_by: null,
    voided_at: null,
    voided_reason: null,
    idempotency_key: 'idem-1',
    created_at: '2026-06-14T10:00:00Z',
    updated_at: '2026-06-14T10:00:00Z',
    clientes: { nombre: 'Ana Cliente' },
    sale_items: [],
    payments: [
      {
        id: 'payment-1',
        sale_id: 'sale-1',
        metodo: 'cash',
        amount: 100_000,
        referencia: null,
        created_at: '2026-06-14T10:00:00Z',
      },
    ],
    ...overrides,
  }
}

describe('rowToSale', () => {
  it('calcula el cambio desde el total recibido y conserva el cliente', () => {
    const sale = rowToSale(makeRow())

    expect(sale.change).toBe(20_000)
    expect(sale.clienteNombre).toBe('Ana Cliente')
  })

  it('no genera cambio negativo para pagos exactos o incompletos históricos', () => {
    const sale = rowToSale(
      makeRow({
        payments: [
          {
            id: 'payment-1',
            sale_id: 'sale-1',
            metodo: 'card',
            amount: 80_000,
            referencia: 'AUTH-1',
            created_at: '2026-06-14T10:00:00Z',
          },
        ],
      })
    )

    expect(sale.change).toBe(0)
  })
})
