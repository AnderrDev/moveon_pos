import { describe, expect, it } from 'vitest'
import { voidSale } from '@angular-app/features/sales/domain/usecases/void-sale.use-case'
import { correctPayment } from '@angular-app/features/sales/domain/usecases/correct-payment.use-case'
import { correctSaleCustomer } from '@angular-app/features/sales/domain/usecases/correct-sale-customer.use-case'

const tiendaId = '11111111-1111-4111-8111-111111111111'
const saleId = '22222222-2222-4222-8222-222222222222'
const paymentId = '33333333-3333-4333-8333-333333333333'
const clienteId = '44444444-4444-4444-8444-444444444444'

describe('voidSale', () => {
  it('anula la venta cuando el motivo es válido', async () => {
    let received: [string, string, string] | null = null
    const repo = {
      voidSale: async (id: string, tid: string, reason: string) => {
        received = [id, tid, reason]
      },
    }
    const result = await voidSale(
      { repo, tiendaId },
      { saleId, voidedReason: 'Producto equivocado' },
    )
    expect(result.ok).toBe(true)
    expect(received).toEqual([saleId, tiendaId, 'Producto equivocado'])
  })

  it('rechaza motivo demasiado corto sin llamar al repositorio', async () => {
    let called = false
    const repo = { voidSale: async () => { called = true } }
    const result = await voidSale({ repo, tiendaId }, { saleId, voidedReason: 'x' })
    expect(result.ok).toBe(false)
    expect(called).toBe(false)
  })
})

describe('correctPayment', () => {
  it('corrige el pago cuando los datos son válidos', async () => {
    let received: [string, string, string, string] | null = null
    const repo = {
      correctPayment: async (id: string, tid: string, newMetodo: string, reason: string) => {
        received = [id, tid, newMetodo, reason]
      },
    }
    const result = await correctPayment(
      { repo, tiendaId },
      { paymentId, newMetodo: 'card', reason: 'El cliente pagó con tarjeta' },
    )
    expect(result.ok).toBe(true)
    expect(received).toEqual([paymentId, tiendaId, 'card', 'El cliente pagó con tarjeta'])
  })

  it('rechaza motivo demasiado corto sin llamar al repositorio', async () => {
    let called = false
    const repo = { correctPayment: async () => { called = true } }
    const result = await correctPayment(
      { repo, tiendaId },
      { paymentId, newMetodo: 'card', reason: 'corto' },
    )
    expect(result.ok).toBe(false)
    expect(called).toBe(false)
  })
})

describe('correctSaleCustomer', () => {
  it('asocia el cliente a la venta cuando los datos son válidos', async () => {
    let received: [string, string, string, string] | null = null
    const repo = {
      correctSaleCustomer: async (id: string, tid: string, cid: string, reason: string) => {
        received = [id, tid, cid, reason]
      },
    }
    const result = await correctSaleCustomer(
      { repo, tiendaId },
      { saleId, clienteId, reason: 'El cliente llegó después del cobro' },
    )
    expect(result.ok).toBe(true)
    expect(received).toEqual([saleId, tiendaId, clienteId, 'El cliente llegó después del cobro'])
  })

  it('rechaza motivo demasiado corto sin llamar al repositorio', async () => {
    let called = false
    const repo = { correctSaleCustomer: async () => { called = true } }
    const result = await correctSaleCustomer(
      { repo, tiendaId },
      { saleId, clienteId, reason: 'corto' },
    )
    expect(result.ok).toBe(false)
    expect(called).toBe(false)
  })

  it('rechaza clienteId inválido sin llamar al repositorio', async () => {
    let called = false
    const repo = { correctSaleCustomer: async () => { called = true } }
    const result = await correctSaleCustomer(
      { repo, tiendaId },
      { saleId, clienteId: 'no-es-uuid', reason: 'El cliente llegó después del cobro' },
    )
    expect(result.ok).toBe(false)
    expect(called).toBe(false)
  })
})
