import '@angular/compiler'
import { Injector, runInInjectionContext } from '@angular/core'
import { describe, expect, it } from 'vitest'
import { SupabaseClientService } from '@angular-app/core/supabase/supabase-client.service'
import { AuditLogRepository } from '@angular-app/features/audit/domain/repositories/audit-log.repository'
import { SalesRepository } from '@angular-app/features/sales/data/repositories/sales.repository'
import type { CreateSaleRequest } from '@angular-app/features/sales/domain/repositories/sale.repository'

const request: CreateSaleRequest = {
  tiendaId: 'tienda-1',
  cashierId: 'cajero-1',
  cashSessionId: 'sesion-1',
  idempotencyKey: 'flow-1',
  clienteId: 'cliente-1',
  items: [
    {
      key: 'batido-1:proteina-1',
      productId: 'batido-1',
      nombre: 'Batido',
      sku: undefined,
      quantity: 2,
      unitPrice: 15000,
      optionId: 'proteina-1',
      discountAmount: 1000,
      taxRate: 0,
      taxAmount: 0,
      total: 29000,
    },
  ],
  payments: [{ metodo: 'transfer', amount: 29000, referencia: undefined }],
  totals: { subtotal: 30000, discountTotal: 1000, taxTotal: 0, total: 29000 },
  globalDiscountTotal: 0,
  discountReason: null,
  loyaltyRedemptions: [{ rewardId: 'reward-1', itemIndex: 0 }],
}

function makeRepo(response: { data: string | null; error: { message: string } | null }) {
  const rpcCalls: { fn: string; args: Record<string, unknown> }[] = []
  const audits: unknown[] = []
  const injector = Injector.create({
    providers: [
      {
        provide: SupabaseClientService,
        useValue: {
          supabase: {
            rpc: async (fn: string, args: Record<string, unknown>) => {
              rpcCalls.push({ fn, args })
              return response
            },
          },
        },
      },
      { provide: AuditLogRepository, useValue: { log: async (e: unknown) => void audits.push(e) } },
    ],
  })
  const repo = runInInjectionContext(injector, () => new SalesRepository())
  return { repo, rpcCalls, audits }
}

describe('SalesRepository.create', () => {
  it('envía el contrato exacto de create_sale_atomic y audita la venta', async () => {
    const { repo, rpcCalls, audits } = makeRepo({ data: 'sale-1', error: null })
    await expect(repo.create(request)).resolves.toBe('sale-1')

    expect(rpcCalls).toHaveLength(1)
    expect(rpcCalls[0]?.fn).toBe('create_sale_atomic')
    expect(rpcCalls[0]?.args).toEqual({
      p_tienda_id: 'tienda-1',
      p_cash_session_id: 'sesion-1',
      p_sale_number: '',
      p_cashier_id: 'cajero-1',
      p_cliente_id: 'cliente-1',
      p_subtotal: 30000,
      p_discount_total: 1000,
      p_tax_total: 0,
      p_total: 29000,
      p_idempotency_key: 'flow-1',
      p_items: [
        {
          producto_id: 'batido-1',
          producto_nombre: 'Batido',
          producto_sku: null,
          quantity: 2,
          unit_price: 15000,
          option_id: 'proteina-1',
          discount_amount: 1000,
          tax_rate: 0,
          tax_amount: 0,
          total: 29000,
        },
      ],
      p_payments: [{ metodo: 'transfer', amount: 29000, referencia: null }],
      p_global_discount_total: 0,
      p_discount_reason: null,
      p_loyalty_redemptions: [{ reward_id: 'reward-1', item_index: 0 }],
    })
    expect(audits).toEqual([
      {
        tiendaId: 'tienda-1',
        entityType: 'venta',
        entityId: 'sale-1',
        action: 'create',
        changes: { total: 29000, items: 1, payments: ['transfer'] },
      },
    ])
  })

  it('envía p_loyalty_redemptions null cuando no hay canjes', async () => {
    const { repo, rpcCalls } = makeRepo({ data: 'sale-1', error: null })
    await repo.create({ ...request, loyaltyRedemptions: [] })
    expect(rpcCalls[0]?.args['p_loyalty_redemptions']).toBeNull()
  })

  it('relanza el mensaje crudo de la RPC y no audita', async () => {
    const { repo, audits } = makeRepo({ data: null, error: { message: 'Stock insuficiente' } })
    await expect(repo.create(request)).rejects.toThrow('Stock insuficiente')
    expect(audits).toHaveLength(0)
  })
})
