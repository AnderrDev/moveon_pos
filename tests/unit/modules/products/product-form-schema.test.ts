import { describe, expect, it } from 'vitest'
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
  it('devuelve nombre vacío por defecto', () => {
    expect(createCategoriaFormDefaults()).toEqual({ nombre: '' })
  })

  it('permite sobreescribir valores iniciales', () => {
    expect(createCategoriaFormDefaults({ nombre: 'Snacks' })).toEqual({ nombre: 'Snacks' })
  })
})

describe('productFormSchema', () => {
  const validProduct = {
    nombre: 'Whey Protein 1kg',
    sku: 'WHY-001',
    codigoBarras: '',
    categoriaId: '',
    paraQueSirve: 'Apoya la recuperacion muscular.',
    recomendadoPara: 'Personas activas que buscan complementar su proteina diaria.',
    tipo: 'simple',
    unidad: 'und',
    precioVenta: 110000,
    costo: 70000,
    ivaTasa: 19,
    stockMinimo: 2,
    stockInicial: 12,
    stockInicialUbicacion: 'bodega',
    isActive: true,
  }

  it('acepta un producto válido', () => {
    const result = productFormSchema.safeParse(validProduct)
    expect(result.success).toBe(true)
  })

  // ── IVA ──────────────────────────────────────────────────────────────────────

  it('acepta el IVA por defecto (0) que produce createProductFormDefaults', () => {
    const defaults = createProductFormDefaults()
    expect(defaults.ivaTasa).toBe(0)

    const result = productFormSchema.safeParse({
      ...defaults,
      nombre: 'Producto válido',
      precioVenta: 1000,
    })
    expect(result.success).toBe(true)
    if (!result.success) {
      expect(result.error.issues.map((i) => i.path)).not.toContainEqual(['ivaTasa'])
    }
  })

  it.each([0, 5, 19] as const)('acepta IVA permitido (%i)', (ivaTasa) => {
    const result = productFormSchema.safeParse({ ...validProduct, ivaTasa })
    expect(result.success).toBe(true)
  })

  it('rechaza un IVA no permitido (16)', () => {
    const result = productFormSchema.safeParse({ ...validProduct, ivaTasa: 16 })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['ivaTasa'])
    }
  })

  // ── Costo (opcional) ──────────────────────────────────────────────────────────

  it('acepta costo undefined', () => {
    const result = productFormSchema.safeParse({ ...validProduct, costo: undefined })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.costo).toBeUndefined()
  })

  it('normaliza costo vacío ("") a undefined (caso del bug)', () => {
    const result = productFormSchema.safeParse({ ...validProduct, costo: '' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.costo).toBeUndefined()
  })

  it('acepta un costo presente y lo conserva', () => {
    const result = productFormSchema.safeParse({ ...validProduct, costo: 70000 })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.costo).toBe(70000)
  })

  it('conserva el costo cero (no lo trata como vacío)', () => {
    const result = productFormSchema.safeParse({ ...validProduct, costo: 0 })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.costo).toBe(0)
  })

  it('rechaza un costo negativo', () => {
    const result = productFormSchema.safeParse({ ...validProduct, costo: -1 })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['costo'])
    }
  })

  it('rechaza un costo no numérico', () => {
    const result = productFormSchema.safeParse({ ...validProduct, costo: 'abc' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['costo'])
    }
  })

  // ── Precio de venta ─────────────────────────────────────────────────────────

  it('rechaza precio de venta en cero', () => {
    const result = productFormSchema.safeParse({ ...validProduct, precioVenta: 0 })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['precioVenta'])
    }
  })

  it('rechaza precio de venta negativo', () => {
    const result = productFormSchema.safeParse({ ...validProduct, precioVenta: -5 })
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

  it('acepta inventario inicial en una ubicación válida', () => {
    const result = productFormSchema.safeParse({
      ...validProduct,
      stockInicial: 8,
      stockInicialUbicacion: 'punto_venta',
    })

    expect(result.success).toBe(true)
  })

  it('rechaza inventario inicial negativo', () => {
    const result = productFormSchema.safeParse({ ...validProduct, stockInicial: -1 })

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues[0].path).toEqual(['stockInicial'])
  })

  it('rechaza inventario inicial para productos preparados', () => {
    const result = productFormSchema.safeParse({
      ...validProduct,
      tipo: 'prepared',
      stockInicial: 1,
    })

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues[0].path).toEqual(['stockInicial'])
  })

  it('rechaza categorías que no son uuid cuando se envían', () => {
    const result = productFormSchema.safeParse({ ...validProduct, categoriaId: 'no-es-uuid' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['categoriaId'])
    }
  })

  it('rechaza informacion comercial que supera el limite', () => {
    const result = productFormSchema.safeParse({
      ...createProductFormDefaults(),
      nombre: 'Producto valido',
      precioVenta: 1000,
      paraQueSirve: 'a'.repeat(801),
    })

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues[0].path).toEqual(['paraQueSirve'])
  })

})

describe('createProductFormDefaults', () => {
  it('devuelve defaults limpios cuando no recibe iniciales', () => {
    const defaults = createProductFormDefaults()
    expect(defaults.nombre).toBe('')
    expect(defaults.sku).toBe('')
    expect(defaults.paraQueSirve).toBe('')
    expect(defaults.recomendadoPara).toBe('')
    expect(defaults.precioVenta).toBe(0)
    expect(defaults.costo).toBeUndefined()
    expect(defaults.ivaTasa).toBe(0)
    expect(defaults.stockMinimo).toBe(0)
    expect(defaults.stockInicial).toBe(0)
    expect(defaults.stockInicialUbicacion).toBe('bodega')
    expect(defaults.tipo).toBe('simple')
    expect(defaults.unidad).toBe('und')
    expect(defaults.isActive).toBe(true)
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
      paraQueSirve: 'Aporta proteina.',
      recomendadoPara: 'Personas activas.',
      tipo: 'ingredient' as const,
      unidad: 'kg',
      precioVenta: 5000,
      costo: 3000,
      ivaTasa: 5 as const,
      stockMinimo: 10,
      stockInicial: 25,
      stockInicialUbicacion: 'punto_venta' as const,
      isActive: false,
    }

    expect(createProductFormDefaults(initial)).toEqual(initial)
  })
})
