import { describe, expect, it } from 'vitest'
import { createSale } from '@angular-app/features/sales/domain/usecases/create-sale.use-case'
import type { CreateSaleRequest } from '@angular-app/features/sales/domain/repositories/sale.repository'

const tiendaId = '11111111-1111-4111-8111-111111111111'
const cashierId = '22222222-2222-4222-8222-222222222222'
const sessionId = '33333333-3333-4333-8333-333333333333'
const whey = '44444444-4444-4444-8444-444444444444'
const batido = '55555555-5555-4555-8555-555555555555'
const proteina = '66666666-6666-4666-8666-666666666666'
const rewardId = '77777777-7777-4777-8777-777777777777'

function line(productId: string, key: string, total: number, optionId: string | null = null) {
  return {
    key,
    productId,
    nombre: 'Producto',
    sku: null,
    quantity: 1,
    unitPrice: total,
    optionId,
    discountAmount: 0,
    taxRate: 0,
    taxAmount: 0,
    total,
  }
}

function saleInput(overrides: Record<string, unknown> = {}) {
  return {
    cashSessionId: sessionId,
    idempotencyKey: 'flow-1',
    clienteId: null,
    items: [line(whey, whey, 90000), line(batido, `${batido}:${proteina}`, 15000, proteina)],
    payments: [{ metodo: 'cash', amount: 105000 }],
    totals: { subtotal: 105000, discountTotal: 0, taxTotal: 0, total: 105000 },
    globalDiscountTotal: 0,
    discountReason: null,
    ...overrides,
  }
}

function fakeRepo(impl?: (request: CreateSaleRequest) => Promise<string>) {
  const calls: CreateSaleRequest[] = []
  return {
    calls,
    repo: {
      create: async (request: CreateSaleRequest) => {
        calls.push(request)
        return impl ? impl(request) : 'sale-1'
      },
    },
  }
}

describe('createSale', () => {
  it('persiste la venta con tienda y cajero del contexto', async () => {
    const { repo, calls } = fakeRepo()
    const result = await createSale({ repo, tiendaId, cashierId }, saleInput())

    expect(result).toEqual({ ok: true, value: { saleId: 'sale-1' } })
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({ tiendaId, cashierId, cashSessionId: sessionId, idempotencyKey: 'flow-1' })
    expect(calls[0]?.loyaltyRedemptions).toEqual([])
  })

  it('resuelve cada canje al índice de su línea por key (producto + opción)', async () => {
    const { repo, calls } = fakeRepo()
    await createSale(
      { repo, tiendaId, cashierId },
      saleInput({ loyaltyRedemptions: [{ rewardId, itemKey: `${batido}:${proteina}` }] }),
    )
    expect(calls[0]?.loyaltyRedemptions).toEqual([{ rewardId, itemIndex: 1 }])
  })

  it('rechaza un canje cuya línea ya no está en el carrito, sin persistir', async () => {
    const { repo, calls } = fakeRepo()
    const result = await createSale(
      { repo, tiendaId, cashierId },
      saleInput({ loyaltyRedemptions: [{ rewardId, itemKey: batido }] }),
    )
    expect(result).toEqual({
      ok: false,
      error: { kind: 'validation', message: 'El producto del canje ya no está en el carrito' },
    })
    expect(calls).toHaveLength(0)
  })

  it('rechaza datos inválidos sin persistir', async () => {
    const { repo, calls } = fakeRepo()
    const result = await createSale({ repo, tiendaId, cashierId }, saleInput({ items: [] }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe('validation')
    expect(calls).toHaveLength(0)
  })

  it('devuelve el rechazo de la RPC como error remoto con el mensaje crudo', async () => {
    const { repo } = fakeRepo(async () => {
      throw new Error('Stock insuficiente')
    })
    const result = await createSale({ repo, tiendaId, cashierId }, saleInput())
    expect(result).toEqual({ ok: false, error: { kind: 'remote', message: 'Stock insuficiente' } })
  })
})
