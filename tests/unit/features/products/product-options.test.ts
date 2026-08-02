import { describe, expect, it, vi } from 'vitest'
import { saveProductOptions } from '@angular-app/features/products/domain/usecases/save-product-options.use-case'
import type { ProductOption } from '@angular-app/features/products/domain/repositories/product.repository'

const COMPONENT_ID = '11111111-1111-4111-8111-111111111111'

function option(overrides: Partial<ProductOption> = {}): ProductOption {
  return {
    grupo: 'Proteína',
    nombre: 'CH+',
    precioExtra: 0,
    componenteId: null,
    componenteNombre: '',
    componenteCantidad: 0,
    esDefault: true,
    ...overrides,
  }
}

function repoSpy() {
  return { saveOptions: vi.fn().mockResolvedValue(undefined) }
}

describe('saveProductOptions', () => {
  it('guarda el juego completo de opciones del batido', async () => {
    const repo = repoSpy()
    const options = [
      option(),
      option({ nombre: 'Bipro', precioExtra: 2000, esDefault: false, componenteId: COMPONENT_ID, componenteCantidad: 1 }),
      option({ nombre: 'Best Whey', precioExtra: 1000, esDefault: false }),
    ]

    const result = await saveProductOptions({ repo }, 'producto-1', 'tienda-1', options)

    expect(result.ok).toBe(true)
    expect(repo.saveOptions).toHaveBeenCalledWith('producto-1', 'tienda-1', options)
  })

  it('rechaza dos opciones con el mismo nombre', async () => {
    const repo = repoSpy()
    const result = await saveProductOptions({ repo }, 'producto-1', 'tienda-1', [
      option(),
      option({ nombre: 'ch+', esDefault: false }),
    ])

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.message).toBe('Hay opciones con el mismo nombre')
    expect(repo.saveOptions).not.toHaveBeenCalled()
  })

  it('rechaza más de una opción predeterminada', async () => {
    const repo = repoSpy()
    const result = await saveProductOptions({ repo }, 'producto-1', 'tienda-1', [
      option(),
      option({ nombre: 'Bipro' }),
    ])

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.message).toBe('Solo una opción puede ser la predeterminada')
  })

  it('rechaza un recargo negativo', async () => {
    const repo = repoSpy()
    const result = await saveProductOptions({ repo }, 'producto-1', 'tienda-1', [
      option({ precioExtra: -500 }),
    ])

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.message).toBe('El recargo no puede ser negativo')
  })

  it('exige cantidad cuando la opción descuenta inventario', async () => {
    const repo = repoSpy()
    const result = await saveProductOptions({ repo }, 'producto-1', 'tienda-1', [
      option({ nombre: 'Bipro', componenteId: COMPONENT_ID, componenteCantidad: 0 }),
    ])

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.message).toBe('Indica cuánto consume la opción "Bipro"')
  })

  it('acepta una lista vacía: el producto se vende sin preguntar', async () => {
    const repo = repoSpy()
    const result = await saveProductOptions({ repo }, 'producto-1', 'tienda-1', [])

    expect(result.ok).toBe(true)
    expect(repo.saveOptions).toHaveBeenCalledWith('producto-1', 'tienda-1', [])
  })
})
