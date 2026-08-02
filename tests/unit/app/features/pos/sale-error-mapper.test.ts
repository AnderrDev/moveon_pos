import { describe, it, expect } from 'vitest'
import {
  mapSaleError,
  type SaleErrorCartItem,
} from '@angular-app/features/pos/presentation/services/sale-error-mapper'

const item = (
  nombre: string,
  quantity: number,
  maxQuantity: number | null,
): SaleErrorCartItem => ({ nombre, quantity, maxQuantity })

describe('mapSaleError', () => {
  it('reconstruye disponible/solicitado para un único producto sin stock', () => {
    const result = mapSaleError('Stock insuficiente', [item('Proteína', 9, 8)])
    expect(result).toBe('Stock insuficiente de "Proteína": disponible 8, solicitado 9')
  })

  it('cae al fallback de stock cuando no hay un producto único identificable', () => {
    const result = mapSaleError('Stock insuficiente', [
      item('Proteína', 9, 8),
      item('Creatina', 5, 3),
    ])
    expect(result).toBe('Stock insuficiente para completar la venta')
  })

  it('cae al fallback de stock cuando ningún ítem rastrea stock', () => {
    const result = mapSaleError('Stock insuficiente', [item('Batido', 10, null)])
    expect(result).toBe('Stock insuficiente para completar la venta')
  })

  it('mapea el mensaje de caja al copy accionable canónico', () => {
    const result = mapSaleError('No hay caja abierta para esta venta', [])
    expect(result).toBe('No hay una caja abierta. Abre la caja antes de vender.')
  })

  it('mapea el mensaje de caja al copy canónico aunque venga con prefijo del driver', () => {
    const result = mapSaleError('error: No hay caja abierta para esta venta', [])
    expect(result).toBe('No hay una caja abierta. Abre la caja antes de vender.')
  })

  it('mapea el mensaje de caja al copy canónico sin importar mayúsc/minúsc', () => {
    const result = mapSaleError('NO HAY CAJA ABIERTA PARA ESTA VENTA', [])
    expect(result).toBe('No hay una caja abierta. Abre la caja antes de vender.')
  })

  it('pasa el mensaje de pagos en español tal cual', () => {
    const result = mapSaleError('La suma de pagos no cubre el total de la venta', [])
    expect(result).toBe('La suma de pagos no cubre el total de la venta')
  })

  it('pasa el mensaje de cambio en español tal cual', () => {
    const result = mapSaleError('El cambio solo puede generarse desde pagos en efectivo', [])
    expect(result).toBe('El cambio solo puede generarse desde pagos en efectivo')
  })

  it('pasa el mensaje de producto no disponible tal cual', () => {
    const result = mapSaleError('Producto no disponible', [])
    expect(result).toBe('Producto no disponible')
  })

  it('devuelve el genérico ante un mensaje desconocido', () => {
    const result = mapSaleError('connection reset by peer', [])
    expect(result).toBe('Error al crear venta')
  })

  it('reconoce la cadena de stock aunque venga con prefijo del driver', () => {
    const result = mapSaleError('error: Stock insuficiente', [item('Proteína', 9, 8)])
    expect(result).toBe('Stock insuficiente de "Proteína": disponible 8, solicitado 9')
  })
})
