import '@angular/compiler'
import { Injector, runInInjectionContext } from '@angular/core'
import { describe, expect, it } from 'vitest'
import { SupabaseClientService } from '@angular-app/core/supabase/supabase-client.service'
import { SessionService } from '@angular-app/core/auth/session.service'
import { AuditLogRepository } from '@angular-app/features/audit/domain/repositories/audit-log.repository'
import { CustomersRepository } from '@angular-app/features/customers/data/repositories/customers.repository'

// findById sirve para ventas pasadas (tirilla): debe devolver también un
// cliente eliminado, así que NO filtra deleted_at (a diferencia de list/búsqueda).

describe('CustomersRepository.findById', () => {
  it('filtra por tienda e id sin excluir eliminados', async () => {
    const filters: [string, string, unknown][] = []
    const builder = {
      select: () => builder,
      eq: (col: string, value: unknown) => (filters.push(['eq', col, value]), builder),
      is: (col: string, value: unknown) => (filters.push(['is', col, value]), builder),
      maybeSingle: () => builder,
      returns: () =>
        Promise.resolve({
          data: {
            id: 'c-1', tienda_id: 't-1', tipo_documento: 'CC', numero_documento: '123', nombre: 'Ana',
            email: null, telefono: null, celular_normalizado: null, activo: false,
            autoriza_fidelizacion: true, acepta_mensajes_promocionales: false,
            created_at: '2026-10-24T00:00:00.000Z', updated_at: '2026-10-24T00:00:00.000Z',
          },
          error: null,
        }),
    }
    const injector = Injector.create({
      providers: [
        { provide: SupabaseClientService, useValue: { supabase: { from: () => builder } } },
        { provide: SessionService, useValue: {} },
        { provide: AuditLogRepository, useValue: { log: async () => undefined } },
      ],
    })
    const repo = runInInjectionContext(injector, () => new CustomersRepository())
    const cliente = await repo.findById('c-1', 't-1')
    expect(cliente?.nombre).toBe('Ana')
    expect(filters).toEqual([['eq', 'tienda_id', 't-1'], ['eq', 'id', 'c-1']])
  })
})
