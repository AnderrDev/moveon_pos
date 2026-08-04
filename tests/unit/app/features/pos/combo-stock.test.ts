import { describe, expect, it } from 'vitest'
import { deriveComboStock } from '@angular-app/features/pos/presentation/services/combo-stock'

describe('deriveComboStock', () => {
  it('lo limita el producto incluido más escaso', () => {
    expect(
      deriveComboStock([
        { cantidad: 1, stockDisponible: 10 },
        { cantidad: 1, stockDisponible: 3 },
      ]),
    ).toBe(3)
  })

  it('divide por la cantidad que consume cada unidad del combo', () => {
    // 10 sachets alcanzan para 5 combos que llevan 2 cada uno.
    expect(deriveComboStock([{ cantidad: 2, stockDisponible: 10 }])).toBe(5)
  })

  it('trunca hacia abajo: no se arma un combo a medias', () => {
    expect(deriveComboStock([{ cantidad: 3, stockDisponible: 8 }])).toBe(2)
  })

  it('devuelve 0 si algún producto incluido está agotado', () => {
    expect(
      deriveComboStock([
        { cantidad: 1, stockDisponible: 50 },
        { cantidad: 1, stockDisponible: 0 },
      ]),
    ).toBe(0)
  })

  it('devuelve 0 si un producto incluido tiene stock negativo', () => {
    expect(deriveComboStock([{ cantidad: 1, stockDisponible: -4 }])).toBe(0)
  })

  it('devuelve 0 cuando el combo no tiene productos incluidos', () => {
    expect(deriveComboStock([])).toBe(0)
  })

  it('ignora filas con cantidad no positiva en vez de dividir por cero', () => {
    expect(
      deriveComboStock([
        { cantidad: 0, stockDisponible: 10 },
        { cantidad: 1, stockDisponible: 4 },
      ]),
    ).toBe(4)
  })

  it('devuelve 0 si todas las filas son inválidas', () => {
    expect(deriveComboStock([{ cantidad: 0, stockDisponible: 10 }])).toBe(0)
  })
})
