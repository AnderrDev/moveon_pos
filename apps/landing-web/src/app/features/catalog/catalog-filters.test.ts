import { describe, expect, it } from 'vitest'
import type { CatalogoCategoria, CatalogoProducto } from './catalogo.service'
import {
  filterProducts,
  normalize,
  OFFERS_MAX,
  paginate,
  PRODUCTS_PAGE_SIZE,
  selectOffers,
  shortText,
  totalPages,
  visibleCategories,
} from './catalog-filters'

function producto(overrides: Partial<CatalogoProducto> = {}): CatalogoProducto {
  return {
    id: overrides.id ?? 'id-1',
    nombre: overrides.nombre ?? 'Proteína Whey',
    tipo: overrides.tipo ?? 'simple',
    paraQueSirve: overrides.paraQueSirve ?? null,
    imageUrl: overrides.imageUrl ?? null,
    marca: overrides.marca ?? null,
    etiqueta: overrides.etiqueta ?? null,
    categoriaId: overrides.categoriaId ?? 'cat-1',
    categoriaNombre: overrides.categoriaNombre ?? 'Proteínas',
    categoriaOrden: overrides.categoriaOrden ?? 1,
  }
}

function categoria(nombre: string, productos: CatalogoProducto[] = []): CatalogoCategoria {
  return { id: `cat-${nombre}`, nombre, orden: 1, productos }
}

describe('normalize', () => {
  it('pasa a minúsculas y quita tildes', () => {
    expect(normalize('Proteína')).toBe('proteina')
    expect(normalize('CREATINA')).toBe('creatina')
  })

  it('normaliza la eñe sin romperla', () => {
    // La ñ es una letra propia en español, no una n con tilde: debe sobrevivir.
    expect(normalize('Piña')).toBe('pina')
  })

  it('deja intacto un texto ya normalizado', () => {
    expect(normalize('sachet')).toBe('sachet')
  })
})

describe('visibleCategories', () => {
  it('oculta las categorías internas del negocio', () => {
    const cats = [categoria('Proteínas'), categoria('Ingredientes para batidos')]
    expect(visibleCategories(cats).map((c) => c.nombre)).toEqual(['Proteínas'])
  })
})

describe('filterProducts', () => {
  const productos = [
    producto({
      id: '1',
      nombre: 'Proteína Whey',
      marca: 'Optimum',
      categoriaId: 'cat-prot',
      categoriaNombre: 'Proteínas',
    }),
    producto({
      id: '2',
      nombre: 'Creatina Micronizada',
      categoriaId: 'cat-crea',
      categoriaNombre: 'Creatinas',
    }),
    producto({
      id: '3',
      nombre: 'Sachet surtido',
      paraQueSirve: 'Energía antes de entrenar',
      categoriaId: 'cat-crea',
      categoriaNombre: 'Creatinas',
    }),
  ]

  it('sin filtros devuelve todo', () => {
    expect(filterProducts(productos, { categoryId: 'all', search: '' })).toHaveLength(3)
  })

  it('filtra por categoría', () => {
    const result = filterProducts(productos, { categoryId: 'cat-crea', search: '' })
    expect(result.map((p) => p.id)).toEqual(['2', '3'])
  })

  it('busca ignorando tildes', () => {
    const result = filterProducts(productos, { categoryId: 'all', search: 'proteina' })
    expect(result.map((p) => p.id)).toEqual(['1'])
  })

  it('busca también en marca, categoría y para-qué-sirve', () => {
    expect(filterProducts(productos, { categoryId: 'all', search: 'optimum' }).map((p) => p.id)).toEqual(['1'])
    expect(filterProducts(productos, { categoryId: 'all', search: 'entrenar' }).map((p) => p.id)).toEqual(['3'])
    expect(filterProducts(productos, { categoryId: 'all', search: 'creatinas' }).map((p) => p.id)).toEqual(['2', '3'])
  })

  it('busca por subcadena, no por palabra completa', () => {
    // "Micronizada" contiene "on": el buscador es deliberadamente permisivo.
    expect(filterProducts(productos, { categoryId: 'all', search: 'on' }).map((p) => p.id)).toEqual(['2'])
  })

  it('combina categoría y búsqueda', () => {
    const result = filterProducts(productos, { categoryId: 'cat-crea', search: 'micronizada' })
    expect(result.map((p) => p.id)).toEqual(['2'])
  })

  it('devuelve vacío cuando nada coincide', () => {
    expect(filterProducts(productos, { categoryId: 'all', search: 'zzz' })).toEqual([])
  })
})

describe('selectOffers', () => {
  it('ordena por prioridad de etiqueta y luego alfabéticamente', () => {
    const productos = [
      producto({ id: 'a', nombre: 'Zinc', etiqueta: 'Nuevo' }),
      producto({ id: 'b', nombre: 'Barra', etiqueta: 'Promoción' }),
      producto({ id: 'c', nombre: 'Amino', etiqueta: 'Más vendido' }),
      producto({ id: 'd', nombre: 'Aloe', etiqueta: 'Nuevo' }),
    ]
    expect(selectOffers(productos).map((p) => p.id)).toEqual(['b', 'c', 'd', 'a'])
  })

  it('excluye productos sin etiqueta', () => {
    const productos = [
      producto({ id: 'a', etiqueta: null }),
      producto({ id: 'b', etiqueta: 'Nuevo' }),
    ]
    expect(selectOffers(productos).map((p) => p.id)).toEqual(['b'])
  })

  it('manda las etiquetas desconocidas al final', () => {
    const productos = [
      producto({ id: 'a', nombre: 'A', etiqueta: 'Edición limitada' }),
      producto({ id: 'b', nombre: 'B', etiqueta: 'Promoción' }),
    ]
    expect(selectOffers(productos).map((p) => p.id)).toEqual(['b', 'a'])
  })

  it('corta en OFFERS_MAX', () => {
    const productos = Array.from({ length: OFFERS_MAX + 4 }, (_, i) =>
      producto({ id: `p${i}`, nombre: `Producto ${i}`, etiqueta: 'Nuevo' }),
    )
    expect(selectOffers(productos)).toHaveLength(OFFERS_MAX)
  })

  it('no muta el arreglo de entrada', () => {
    const productos = [
      producto({ id: 'a', nombre: 'Zinc', etiqueta: 'Nuevo' }),
      producto({ id: 'b', nombre: 'Barra', etiqueta: 'Promoción' }),
    ]
    selectOffers(productos)
    expect(productos.map((p) => p.id)).toEqual(['a', 'b'])
  })
})

describe('totalPages', () => {
  it('nunca baja de 1, ni con lista vacía', () => {
    expect(totalPages(0)).toBe(1)
  })

  it('redondea hacia arriba', () => {
    expect(totalPages(PRODUCTS_PAGE_SIZE)).toBe(1)
    expect(totalPages(PRODUCTS_PAGE_SIZE + 1)).toBe(2)
  })
})

describe('paginate', () => {
  const items = Array.from({ length: 25 }, (_, i) => i)

  it('devuelve la porción de la página pedida', () => {
    expect(paginate(items, 1)).toEqual(items.slice(0, 10))
    expect(paginate(items, 3)).toEqual(items.slice(20, 25))
  })

  it('acota una página por encima del total', () => {
    expect(paginate(items, 99)).toEqual(items.slice(20, 25))
  })

  it('acota una página por debajo de 1', () => {
    expect(paginate(items, 0)).toEqual(items.slice(0, 10))
  })

  it('tolera lista vacía', () => {
    expect(paginate([], 1)).toEqual([])
  })
})

describe('shortText', () => {
  it('deja los textos cortos intactos', () => {
    expect(shortText('  Energía antes de entrenar  ')).toBe('Energía antes de entrenar')
  })

  it('recorta los textos largos con puntos suspensivos', () => {
    const largo = 'a'.repeat(120)
    const result = shortText(largo)
    expect(result).toHaveLength(92)
    expect(result.endsWith('...')).toBe(true)
  })

  it('no recorta justo en el límite', () => {
    const limite = 'a'.repeat(92)
    expect(shortText(limite)).toBe(limite)
  })
})
