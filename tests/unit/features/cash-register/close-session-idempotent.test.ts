import '@angular/compiler'
import { Injector, runInInjectionContext } from '@angular/core'
import { describe, expect, it } from 'vitest'
import { SupabaseClientService } from '@angular-app/core/supabase/supabase-client.service'
import { AuditLogRepository } from '@angular-app/features/audit/domain/repositories/audit-log.repository'
import { CashRegisterRepository } from '@angular-app/features/cash-register/data/repositories/cash-register.repository'

// Reintentar el cierre tras perder la respuesta: la RPC ya cerró la caja y
// rechaza con "ya esta cerrada". Si la cerró el mismo usuario, es éxito.

function sessionRow(closedBy: string | null) {
  return {
    id: 'sesion-1', tienda_id: 'tienda-1', opened_by: 'cajero-1', closed_by: closedBy,
    closed_by_email: null, status: closedBy ? 'closed' : 'open', opening_amount: 100000,
    expected_cash_amount: 150000, actual_cash_amount: 150000, closing_withdrawal_amount: 50000,
    cash_left_amount: 100000, difference: 0, expected_sales_amount: 50000, actual_sales_amount: 50000,
    sales_difference: 0, payment_closure: {}, notas_cierre: null,
    opened_at: '2026-10-24T13:00:00.000Z', closed_at: closedBy ? '2026-10-24T22:00:00.000Z' : null,
  }
}

function makeRepo(closedBy: string | null) {
  const audits: unknown[] = []
  const builder = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: () => builder,
    returns: () => Promise.resolve({ data: sessionRow(closedBy), error: null }),
  }
  const injector = Injector.create({
    providers: [
      {
        provide: SupabaseClientService,
        useValue: {
          supabase: {
            rpc: async () => ({ data: null, error: { message: 'La caja ya esta cerrada' } }),
            from: () => builder,
          },
        },
      },
      { provide: AuditLogRepository, useValue: { log: async (e: unknown) => void audits.push(e) } },
    ],
  })
  return { repo: runInInjectionContext(injector, () => new CashRegisterRepository()), audits }
}

const input = {
  sessionId: 'sesion-1',
  tiendaId: 'tienda-1',
  closedBy: 'cajero-1',
  actualCashAmount: 150000,
  cashLeftAmount: 100000,
  actualPayments: [],
}

describe('CashRegisterRepository.closeSession (reintento)', () => {
  it('devuelve la sesión cerrada si la cerró el mismo usuario, sin auditar de nuevo', async () => {
    const { repo, audits } = makeRepo('cajero-1')
    const session = await repo.closeSession(input)
    expect(session.status).toBe('closed')
    expect(session.closedBy).toBe('cajero-1')
    expect(audits).toHaveLength(0)
  })

  it('mantiene el error si la caja la cerró otra persona', async () => {
    const { repo } = makeRepo('admin-1')
    await expect(repo.closeSession(input)).rejects.toThrow('La caja ya esta cerrada')
  })
})
