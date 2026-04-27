import { describe, expect, it } from 'vitest'
import { categoriaFormSchema } from '@/modules/products/forms/categoria-form.factory'
import { productFormSchema } from '@/modules/products/forms/product-form.factory'

describe('categoriaFormSchema', () => {
  it('trimmea y acepta nombres válidos', () => {
    const result = categoriaFormSchema.safeParse({ nombre: '  Proteínas  ' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.nombre).toBe('Proteínas')
  })

  it('rechaza nombres vacíos', () => {
    const result = categoriaFormSchema.safeParse({ nombre: '   ' })
    expect(result.success).toBe(false)
  })
})

describe('productFormSchema', () => {
  const validProduct = {
    nombre: 'Whey Protein 1kg',
    sku: 'WHY-001',
    codigoBarras: '',
    categoriaId: '',
    tipo: 'simple',
    unidad: 'und',
    precioVenta: 110000,
    costo: 70000,
    ivaTasa: 19,
    stockMinimo: 2,
    isActive: true,
  }

  it('acepta un producto válido', () => {
    const result = productFormSchema.safeParse(validProduct)
    expect(result.success).toBe(true)
  })

  it('rechaza precio de venta en cero', () => {
    const result = productFormSchema.safeParse({ ...validProduct, precioVenta: 0 })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['precioVenta'])
    }
  })

  it('rechaza stock mínimo negativo', () => {
    const result = productFormSchema.safeParse({ ...validProduct, stockMinimo: -1 })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['stockMinimo'])
    }
  })

  it('rechaza categorías que no son uuid cuando se envían', () => {
    const result = productFormSchema.safeParse({ ...validProduct, categoriaId: 'no-es-uuid' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['categoriaId'])
    }
  })
})
