import { describe, expect, it } from 'vitest'
import { formErrorResolver } from '@/shared/forms/form-error-resolver'

describe('formErrorResolver', () => {
  it('devuelve null cuando no hay errores', () => {
    expect(formErrorResolver({})).toBeNull()
  })

  it('devuelve el primer mensaje directo', () => {
    expect(formErrorResolver({
      nombre: { type: 'required', message: 'El nombre es obligatorio' },
    })).toBe('El nombre es obligatorio')
  })

  it('busca mensajes en errores anidados', () => {
    expect(formErrorResolver({
      producto: {
        precio: { type: 'min', message: 'El precio debe ser mayor a 0' },
      },
    })).toBe('El precio debe ser mayor a 0')
  })

  it('ignora errores sin mensaje hasta encontrar uno útil', () => {
    expect(formErrorResolver({
      sku: { type: 'manual' },
      precio: { type: 'min', message: 'El precio debe ser mayor a 0' },
    })).toBe('El precio debe ser mayor a 0')
  })

  it('ignora entradas undefined', () => {
    expect(formErrorResolver({
      nombre: undefined,
      precio: { type: 'min', message: 'El precio debe ser mayor a 0' },
    })).toBe('El precio debe ser mayor a 0')
  })
})
