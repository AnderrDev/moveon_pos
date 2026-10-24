import { describe, expect, it } from 'vitest'
import {
  addProductOption,
  removeProductOption,
  setDefaultProductOption,
  type PendingProductOption,
} from '@angular-app/features/products/presentation/services/product-option-list'

const pending = (overrides: Partial<PendingProductOption> = {}): PendingProductOption => ({
  grupo: 'Proteína',
  nombre: 'Bipro',
  precioExtra: 0,
  componenteId: null,
  componenteNombre: '',
  componenteCantidad: 1,
  ...overrides,
})

function build(...nombres: string[]) {
  return nombres.reduce((list, nombre) => {
    const result = addProductOption(list, pending({ nombre }))
    if (!result.ok) throw new Error(result.error)
    return result.options
  }, [] as ReturnType<typeof removeProductOption>)
}

describe('lista de opciones de venta', () => {
  it('la primera opción queda predeterminada y normaliza recargo y grupo', () => {
    const result = addProductOption([], pending({ nombre: '  Bipro ', precioExtra: 1499.6, grupo: ' ' }))
    expect(result).toEqual({
      ok: true,
      options: [expect.objectContaining({ nombre: 'Bipro', precioExtra: 1500, grupo: 'Proteína', esDefault: true })],
    })
  })

  it('rechaza nombres repetidos sin distinguir mayúsculas', () => {
    expect(addProductOption(build('Bipro'), pending({ nombre: 'BIPRO' }))).toEqual({
      ok: false,
      error: 'Ya existe una opción con ese nombre',
    })
  })

  it('sin componente no descuenta inventario', () => {
    const result = addProductOption([], pending({ componenteNombre: 'Sachet', componenteCantidad: 2 }))
    expect(result.ok && result.options[0]).toMatchObject({ componenteId: null, componenteNombre: '', componenteCantidad: 0 })
  })

  it('al quitar la predeterminada la primera restante toma el relevo', () => {
    const next = removeProductOption(build('A', 'B', 'C'), 'A')
    expect(next.map((o) => [o.nombre, o.esDefault])).toEqual([['B', true], ['C', false]])
  })

  it('cambia la predeterminada', () => {
    const next = setDefaultProductOption(build('A', 'B'), 'B')
    expect(next.map((o) => o.esDefault)).toEqual([false, true])
  })
})
