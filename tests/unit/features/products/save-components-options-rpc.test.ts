import '@angular/compiler'
import { Injector, runInInjectionContext } from '@angular/core'
import { describe, expect, it } from 'vitest'
import { SupabaseClientService } from '@angular-app/core/supabase/supabase-client.service'
import { AuditLogRepository } from '@angular-app/features/audit/domain/repositories/audit-log.repository'
import { ProductsRepository } from '@angular-app/features/products/data/repositories/products.repository'

// Recetas y opciones se guardan con UNA llamada a su RPC atómica (antes:
// delete + insert, o select + upsert + update desde el cliente).

function makeRepo(error: { message: string } | null = null) {
  const calls: { fn: string; args: Record<string, unknown> }[] = []
  const injector = Injector.create({
    providers: [
      {
        provide: SupabaseClientService,
        useValue: {
          supabase: {
            rpc: async (fn: string, args: Record<string, unknown>) => {
              calls.push({ fn, args })
              return { data: error ? null : 1, error }
            },
            from: () => {
              throw new Error('no debe escribir tablas directo')
            },
          },
        },
      },
      { provide: AuditLogRepository, useValue: { log: async () => undefined } },
    ],
  })
  return { repo: runInInjectionContext(injector, () => new ProductsRepository()), calls }
}

describe('ProductsRepository.saveComponents', () => {
  it('reemplaza la receta con save_product_components_atomic', async () => {
    const { repo, calls } = makeRepo()
    await repo.saveComponents('batido', 'tienda-1', [
      { componenteId: 'leche', cantidad: 0.25 },
      { componenteId: 'vaso', cantidad: 1 },
    ])
    expect(calls).toEqual([
      {
        fn: 'save_product_components_atomic',
        args: {
          p_producto_id: 'batido',
          p_tienda_id: 'tienda-1',
          p_components: [
            { tienda_id: 'tienda-1', producto_id: 'batido', componente_id: 'leche', cantidad: 0.25 },
            { tienda_id: 'tienda-1', producto_id: 'batido', componente_id: 'vaso', cantidad: 1 },
          ],
        },
      },
    ])
  })

  it('propaga el rechazo de la RPC', async () => {
    const { repo } = makeRepo({ message: 'Hay componentes repetidos' })
    await expect(repo.saveComponents('batido', 'tienda-1', [])).rejects.toThrow('Hay componentes repetidos')
  })
})

describe('ProductsRepository.saveOptions', () => {
  it('guarda las opciones con save_product_options_atomic en el orden recibido', async () => {
    const { repo, calls } = makeRepo()
    await repo.saveOptions('batido', 'tienda-1', [
      {
        grupo: 'Proteína', nombre: 'Whey', precioExtra: 3000, componenteId: 'whey',
        componenteNombre: 'Whey', componenteCantidad: 0.03, esDefault: true,
      },
      {
        grupo: 'Proteína', nombre: 'Sin proteína', precioExtra: 0, componenteId: null,
        componenteNombre: '', componenteCantidad: 5, esDefault: false,
      },
    ])
    expect(calls).toHaveLength(1)
    expect(calls[0]?.fn).toBe('save_product_options_atomic')
    expect(calls[0]?.args['p_options']).toEqual([
      expect.objectContaining({ nombre: 'Whey', precio_extra: 3000, componente_id: 'whey', componente_cantidad: 0.03, es_default: true }),
      // Sin componente no consume nada aunque el formulario traiga cantidad.
      expect.objectContaining({ nombre: 'Sin proteína', componente_id: null, componente_cantidad: 0, es_default: false }),
    ])
  })
})
