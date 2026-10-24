import '@angular/compiler'
import { Injector, runInInjectionContext } from '@angular/core'
import { describe, expect, it } from 'vitest'
import { SupabaseClientService } from '@angular-app/core/supabase/supabase-client.service'
import { AuditLogRepository } from '@angular-app/features/audit/domain/repositories/audit-log.repository'
import { ProductsRepository } from '@angular-app/features/products/data/repositories/products.repository'

// Lecturas por tienda de componentes y opciones (catálogo del POS): deben
// paginar más allá del tope de 1000 filas de PostgREST y mapear al dominio.

interface Call {
  table: string
  filters: [string, unknown][]
  range?: [number, number]
}

function fakeSupabase(rowsByTable: Record<string, Record<string, unknown>[]>, calls: Call[]) {
  return {
    from(table: string) {
      const call: Call = { table, filters: [] }
      calls.push(call)
      const builder = {
        select: () => builder,
        eq: (col: string, value: unknown) => (call.filters.push([col, value]), builder),
        order: () => builder,
        range: (from: number, to: number) => ((call.range = [from, to]), builder),
        returns: () => {
          const [from, to] = call.range ?? [0, 999]
          const rows = rowsByTable[table] ?? []
          return Promise.resolve({ data: rows.slice(from, Math.min(to + 1, from + 1000)), error: null })
        },
      }
      return builder
    },
  }
}

function makeRepo(rowsByTable: Record<string, Record<string, unknown>[]>, calls: Call[]) {
  const injector = Injector.create({
    providers: [
      { provide: SupabaseClientService, useValue: { supabase: fakeSupabase(rowsByTable, calls) } },
      { provide: AuditLogRepository, useValue: { log: async () => undefined } },
    ],
  })
  return runInInjectionContext(injector, () => new ProductsRepository())
}

describe('ProductsRepository.listComponentsByTienda', () => {
  it('pagina y mapea cada componente con su producto', async () => {
    const rows = Array.from({ length: 1200 }, (_, i) => ({
      producto_id: `p-${i}`,
      componente_id: 'leche',
      cantidad: '0.25',
      productos: { nombre: 'Leche' },
    }))
    const calls: Call[] = []
    const links = await makeRepo({ product_components: rows }, calls).listComponentsByTienda('tienda-1')

    expect(links).toHaveLength(1200)
    expect(links[0]).toEqual({ productoId: 'p-0', componenteId: 'leche', componenteNombre: 'Leche', cantidad: 0.25 })
    expect(calls.map((c) => c.range)).toEqual([[0, 999], [1000, 1999]])
    expect(calls[0]?.filters).toEqual([['tienda_id', 'tienda-1']])
  })
})

describe('ProductsRepository.listActiveOptionsByTienda', () => {
  it('filtra activas por tienda y mapea al dominio con id y producto', async () => {
    const calls: Call[] = []
    const links = await makeRepo(
      {
        product_options: [
          {
            id: 'opt-1', producto_id: 'batido', grupo: 'Proteína', nombre: 'Whey', precio_extra: '3000',
            componente_id: 'whey', componente_cantidad: '1', es_default: true, orden: 0, is_active: true,
            productos: { nombre: 'Whey' },
          },
        ],
      },
      calls,
    ).listActiveOptionsByTienda('tienda-1')

    expect(links).toEqual([
      {
        id: 'opt-1', productoId: 'batido', grupo: 'Proteína', nombre: 'Whey', precioExtra: 3000,
        componenteId: 'whey', componenteNombre: 'Whey', componenteCantidad: 1, esDefault: true,
      },
    ])
    expect(calls[0]?.filters).toEqual([['tienda_id', 'tienda-1'], ['is_active', true]])
  })
})
