import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  categoriaFormSchema,
  createCategoriaFormDefaults,
} from '@/modules/products/forms/categoria-form.factory'
import {
  createProductFormDefaults,
  productFormSchema,
} from '@/modules/products/forms/product-form.factory'

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

describe('createCategoriaFormDefaults', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('permite sobreescribir valores iniciales', () => {
    expect(createCategoriaFormDefaults({ nombre: 'Snacks' })).toEqual({ nombre: 'Snacks' })
  })

  it('precarga categoría en development', () => {
    vi.stubEnv('NODE_ENV', 'development')
    expect(createCategoriaFormDefaults()).toEqual({ nombre: 'Proteínas' })
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

describe('createProductFormDefaults', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('mezcla valores iniciales con defaults', () => {
    const defaults = createProductFormDefaults({
      nombre: 'Creatina',
      precioVenta: 80000,
    })

    expect(defaults.nombre).toBe('Creatina')
    expect(defaults.precioVenta).toBe(80000)
    expect(defaults.tipo).toBe('simple')
    expect(defaults.unidad).toBe('und')
    expect(defaults.isActive).toBe(true)
  })

  it('usa todos los valores iniciales cuando se entregan', () => {
    const initial = {
      nombre: 'Barra',
      sku: 'BAR-001',
      codigoBarras: '770000000001',
      categoriaId: '11111111-1111-4111-8111-111111111111',
      tipo: 'ingredient' as const,
      unidad: 'kg',
      precioVenta: 5000,
      costo: 3000,
      ivaTasa: 5 as const,
      stockMinimo: 10,
      isActive: false,
    }

    expect(createProductFormDefaults(initial)).toEqual(initial)
  })

  it('precarga producto de ejemplo en development', () => {
    vi.stubEnv('NODE_ENV', 'development')
    const defaults = createProductFormDefaults()
    expect(defaults.nombre).toBe('Whey Protein 1kg')
    expect(defaults.sku).toBe('WH001')
    expect(defaults.precioVenta).toBe(110000)
    expect(defaults.costo).toBe(70000)
    expect(defaults.ivaTasa).toBe(19)
    expect(defaults.stockMinimo).toBe(2)
  })
})
