import '@angular/compiler'
import { Injector, runInInjectionContext } from '@angular/core'
import { describe, expect, it } from 'vitest'
import { SupabaseClientService } from '@angular-app/core/supabase/supabase-client.service'
import { AuditLogRepository } from '@angular-app/features/audit/domain/repositories/audit-log.repository'
import { ProductsRepository } from '@angular-app/features/products/data/repositories/products.repository'

// Regresión: listProducts aplicaba `.limit(200)` fijo, así que con más de 200
// productos el POS, inventario y reportes perdían el resto EN SILENCIO.

interface Call {
  range?: [number, number]
  limit?: number
  or?: string
}

function makeRow(i: number) {
  return {
    id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    tienda_id: 'tienda-1',
    nombre: `Producto ${String(i).padStart(4, '0')}`,
    sku: null,
    codigo_barras: null,
    categoria_id: null,
    proveedor_id: null,
    proveedores: null,
    para_que_sirve: null,
    recomendado_para: null,
    image_url: null,
    tipo: 'simple',
    unidad: 'und',
    precio_venta: 1000,
    costo: 500,
    iva_tasa: 0,
    stock_minimo: 0,
    participa_fidelizacion: true,
    is_active: true,
    deleted_at: null,
    created_at: '2026-10-24T00:00:00.000Z',
    updated_at: '2026-10-24T00:00:00.000Z',
  }
}

/** Builder falso de PostgREST: sirve `total` filas y respeta range/limit como el real (tope 1000). */
function fakeSupabase(total: number, calls: Call[]) {
  const rows = Array.from({ length: total }, (_, i) => makeRow(i))
  return {
    from() {
      const call: Call = {}
      calls.push(call)
      const builder = {
        select: () => builder,
        eq: () => builder,
        is: () => builder,
        order: () => builder,
        or: (expr: string) => ((call.or = expr), builder),
        range: (from: number, to: number) => ((call.range = [from, to]), builder),
        limit: (n: number) => ((call.limit = n), builder),
        returns: () => {
          const [from, to] = call.range ?? [0, (call.limit ?? 1000) - 1]
          const end = Math.min(to + 1, from + 1000, call.limit ?? Infinity)
          return Promise.resolve({ data: rows.slice(from, end), error: null })
        },
      }
      return builder
    },
  }
}

function makeRepo(total: number, calls: Call[]): ProductsRepository {
  const injector = Injector.create({
    providers: [
      { provide: SupabaseClientService, useValue: { supabase: fakeSupabase(total, calls) } },
      { provide: AuditLogRepository, useValue: { log: async () => undefined } },
    ],
  })
  return runInInjectionContext(injector, () => new ProductsRepository())
}

describe('ProductsRepository.listProducts', () => {
  it('devuelve el catálogo completo aunque supere 200 productos', async () => {
    const calls: Call[] = []
    const products = await makeRepo(250, calls).listProducts({ tiendaId: 'tienda-1' })
    expect(products).toHaveLength(250)
    expect(calls.every((c) => c.limit === undefined)).toBe(true)
  })

  it('pagina de a 1000 cuando el catálogo supera el tope de PostgREST', async () => {
    const calls: Call[] = []
    const products = await makeRepo(2300, calls).listProducts({ tiendaId: 'tienda-1', soloActivos: true })
    expect(products).toHaveLength(2300)
    expect(calls.map((c) => c.range)).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ])
  })

  it('con término de búsqueda limita los resultados a 200 y sanea el filtro', async () => {
    const calls: Call[] = []
    const products = await makeRepo(250, calls).listProducts({ tiendaId: 'tienda-1', query: 'whey,(x)' })
    expect(products).toHaveLength(200)
    expect(calls).toHaveLength(1)
    expect(calls[0]?.limit).toBe(200)
    expect(calls[0]?.or).toBe('nombre.ilike.%whey  x%,sku.ilike.%whey  x%,codigo_barras.eq.whey  x')
  })
})
