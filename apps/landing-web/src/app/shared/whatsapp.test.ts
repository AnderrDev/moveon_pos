import { describe, expect, it } from 'vitest'
import { WA_MENSAJES, whatsappLink } from './whatsapp'

describe('whatsappLink', () => {
  it('arma la URL de wa.me con el mensaje codificado', () => {
    expect(whatsappLink('573012244006', 'Hola Move On')).toBe(
      'https://wa.me/573012244006?text=Hola%20Move%20On',
    )
  })

  it('codifica emojis y signos de la marca', () => {
    const url = whatsappLink('573012244006', WA_MENSAJES.general)
    expect(url.startsWith('https://wa.me/573012244006?text=')).toBe(true)
    expect(url).not.toContain(' ')
    expect(decodeURIComponent(url.split('?text=')[1])).toBe(WA_MENSAJES.general)
  })

  it('mantiene el nombre del producto en el mensaje', () => {
    const msg = WA_MENSAJES.producto('Proteína Whey 5lb')
    expect(msg).toContain('Proteína Whey 5lb')
    expect(decodeURIComponent(whatsappLink('57300', msg).split('?text=')[1])).toBe(msg)
  })

  it('distingue el mensaje de la cinta de destacados', () => {
    const destacado = WA_MENSAJES.productoDestacado('Creatina 300g')
    expect(destacado).toContain('Creatina 300g')
    expect(destacado).toContain('destacado en el catálogo')
    expect(destacado).not.toBe(WA_MENSAJES.producto('Creatina 300g'))
  })
})
