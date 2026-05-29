import { describe, expect, it } from 'vitest'
import {
  indexSiigoRecords,
  parseCop,
  parseCsv,
  parseSiigoRow,
  toEntryMovement,
  toProductInsert,
  validateSiigoRows,
  type SiigoProductRow,
  type SiigoRecord,
} from '@/modules/products/import/siigo-csv'

const HEADER = 'nombre,sku,codigo_barras,categoria,tipo,unidad,precio_venta,costo,iva_tasa,stock_inicial'
const TIENDA = 'a1b2c3d4-0000-0000-0000-000000000001'
const CREATED_BY = '11111111-1111-4111-8111-111111111111'

/** Construye un CSV con header canónico y las filas dadas. */
function csv(...lines: string[]): string {
  return [HEADER, ...lines].join('\n')
}

/** Atajo: parsea + indexa un CSV y devuelve los registros (asume header válido). */
function records(text: string): SiigoRecord[] {
  const indexed = indexSiigoRecords(parseCsv(text))
  if (!indexed.ok) throw new Error('header inválido en el fixture de test')
  return indexed.value
}

/** Atajo: parsea la primera fila de datos de un CSV de una sola fila. */
function firstRow(line: string): ReturnType<typeof parseSiigoRow> {
  const recs = records(csv(line))
  return parseSiigoRow(recs[0])
}

describe('parseCsv', () => {
  it('parsea filas simples separadas por comas', () => {
    const rows = parseCsv('a,b,c\n1,2,3')
    expect(rows).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ])
  })

  it('respeta comas embebidas dentro de comillas', () => {
    const rows = parseCsv('nombre,nota\n"Whey, 2kg",ok')
    expect(rows[1]).toEqual(['Whey, 2kg', 'ok'])
  })

  it('interpreta "" como comilla literal', () => {
    const rows = parseCsv('texto\n"comilla "" interna"')
    expect(rows[1]).toEqual(['comilla " interna'])
  })

  it('acepta fin de línea \\r\\n', () => {
    const rows = parseCsv('a,b\r\n1,2\r\n3,4')
    expect(rows).toEqual([
      ['a', 'b'],
      ['1', '2'],
      ['3', '4'],
    ])
  })

  it('ignora una línea final en blanco', () => {
    const rows = parseCsv('a,b\n1,2\n')
    expect(rows).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  it('elimina el BOM inicial', () => {
    const rows = parseCsv('﻿nombre\nWhey')
    expect(rows[0]).toEqual(['nombre'])
  })
})

describe('parseCop', () => {
  it('"$ 110.000" → 110000', () => {
    const r = parseCop('$ 110.000')
    expect(r.ok && r.value).toBe(110000)
  })

  it('"110.000,50" se rechaza (centavos)', () => {
    expect(parseCop('110.000,50').ok).toBe(false)
  })

  it('"1000.5" se rechaza (decimal)', () => {
    expect(parseCop('1000.5').ok).toBe(false)
  })

  it('entero plano sin separadores → ok', () => {
    const r = parseCop('25000')
    expect(r.ok && r.value).toBe(25000)
  })
})

describe('parseSiigoRow — fila válida', () => {
  it('produce payloads correctos (tienda, sku upper, tipo, números, unidad default)', () => {
    const r = firstRow('whey protein,why-001,770000000001,Proteínas,simple,,110.000,70000,19,12')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const row = r.value
    expect(row.nombre).toBe('whey protein')
    expect(row.sku).toBe('WHY-001')
    expect(row.codigoBarras).toBe('770000000001')
    expect(row.categoria).toBe('Proteínas')
    expect(row.tipo).toBe('simple')
    expect(row.unidad).toBe('und')
    expect(row.precioVenta).toBe(110000)
    expect(row.costo).toBe(70000)
    expect(row.ivaTasa).toBe(19)
    expect(row.stockInicial).toBe(12)

    const product = toProductInsert(row, TIENDA, 'cat-id')
    expect(product).toMatchObject({
      tienda_id: TIENDA,
      categoria_id: 'cat-id',
      sku: 'WHY-001',
      codigo_barras: '770000000001',
      tipo: 'simple',
      unidad: 'und',
      precio_venta: 110000,
      costo: 70000,
      iva_tasa: 19,
    })

    const movement = toEntryMovement(row, 'prod-id', TIENDA, CREATED_BY)
    expect(movement).toEqual({
      tienda_id: TIENDA,
      producto_id: 'prod-id',
      tipo: 'entry',
      cantidad: 12,
      costo_unitario: 70000,
      motivo: 'Stock inicial migración Siigo',
      referencia_tipo: 'siigo_import',
      created_by: CREATED_BY,
    })
  })

  it('respeta una unidad explícita', () => {
    const r = firstRow('Creatina,CRE-001,,,,kg,50000,,5,0')
    expect(r.ok && r.value.unidad).toBe('kg')
  })

  it('tipo prepared con stock 0 es válido (sin movimiento)', () => {
    const r = firstRow('Batido Vainilla,,,,prepared,,12000,,0,0')
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.tipo).toBe('prepared')
      expect(r.value.stockInicial).toBe(0)
    }
  })

  it('sku y categoria vacíos quedan undefined', () => {
    const r = firstRow('Producto sin sku,,,,,,9000,,0,0')
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.sku).toBeUndefined()
      expect(r.value.categoria).toBeUndefined()
    }
  })
})

describe('parseSiigoRow — filas inválidas', () => {
  it('iva 16 → error en columna iva_tasa', () => {
    const r = firstRow('Whey,WHY-001,,,simple,,110000,70000,16,0')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.some((e) => e.column === 'iva_tasa')).toBe(true)
  })

  it('precio 0 → error en columna precio_venta', () => {
    const r = firstRow('Whey,WHY-001,,,simple,,0,70000,19,0')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.some((e) => e.column === 'precio_venta')).toBe(true)
  })

  it('precio -100 → error en columna precio_venta', () => {
    const r = firstRow('Whey,WHY-001,,,simple,,-100,70000,19,0')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.some((e) => e.column === 'precio_venta')).toBe(true)
  })

  it("tipo 'combo' → error en columna tipo", () => {
    const r = firstRow('Whey,WHY-001,,,combo,,110000,70000,19,0')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.some((e) => e.column === 'tipo')).toBe(true)
  })

  it('nombre vacío → error en columna nombre', () => {
    const r = firstRow(',WHY-001,,,simple,,110000,70000,19,0')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.some((e) => e.column === 'nombre')).toBe(true)
  })

  it('stock -1 → error en columna stock_inicial', () => {
    const r = firstRow('Whey,WHY-001,,,simple,,110000,70000,19,-1')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.some((e) => e.column === 'stock_inicial')).toBe(true)
  })

  it("costo 'abc' → error en columna costo", () => {
    const r = firstRow('Whey,WHY-001,,,simple,,110000,abc,19,0')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.some((e) => e.column === 'costo')).toBe(true)
  })

  it("costo '' → undefined", () => {
    const r = firstRow('Whey,WHY-001,,,simple,,110000,,19,0')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.costo).toBeUndefined()
  })

  it('reporta la línea correcta del CSV', () => {
    const recs = records(csv('Whey,WHY-001,,,simple,,110000,70000,19,0', ',,,,,,,,,'))
    const r = parseSiigoRow(recs[1])
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error[0].line).toBe(3)
  })
})

describe('validateSiigoRows — unicidad cross-row', () => {
  it('SKU duplicado → error en la 2ª fila citando la 1ª línea', () => {
    const { valid, errors } = validateSiigoRows(
      records(
        csv(
          'Whey 2kg,WHY-001,,,simple,,110000,70000,19,0',
          'Whey 1kg,WHY-001,,,simple,,80000,50000,19,0',
        ),
      ),
    )
    expect(valid).toHaveLength(1)
    const dup = errors.find((e) => e.column === 'sku')
    expect(dup).toBeDefined()
    expect(dup?.line).toBe(3)
    expect(dup?.message).toContain('línea 2')
  })

  it('código de barras duplicado → error en la 2ª fila', () => {
    const { errors } = validateSiigoRows(
      records(
        csv(
          'Prod A,,770000000001,,simple,,1000,,0,0',
          'Prod B,,770000000001,,simple,,2000,,0,0',
        ),
      ),
    )
    const dup = errors.find((e) => e.column === 'codigo_barras')
    expect(dup?.line).toBe(3)
    expect(dup?.message).toContain('línea 2')
  })

  it('nombre duplicado case-insensitive → error en la 2ª fila', () => {
    const { errors } = validateSiigoRows(
      records(
        csv(
          'Creatina,CRE-001,,,simple,,50000,,0,0',
          'creatina,CRE-002,,,simple,,55000,,0,0',
        ),
      ),
    )
    const dup = errors.find((e) => e.column === 'nombre')
    expect(dup?.line).toBe(3)
    expect(dup?.message).toContain('línea 2')
  })
})

describe('validateSiigoRows — archivo mixto', () => {
  it('separa válidas de errores con conteos correctos', () => {
    const { valid, errors } = validateSiigoRows(
      records(
        csv(
          'Whey,WHY-001,,Proteínas,simple,,110000,70000,19,5', // válida
          'Mala IVA,BAD-001,,,simple,,90000,,16,0', // iva 16 → error
          'Creatina,CRE-001,,,simple,,55000,,5,3', // válida
          'Precio cero,ZERO-001,,,simple,,0,,0,0', // precio 0 → error
        ),
      ),
    )
    expect(valid).toHaveLength(2)
    expect(valid.map((v: SiigoProductRow) => v.nombre).sort()).toEqual(['Creatina', 'Whey'])
    expect(errors.some((e) => e.line === 3 && e.column === 'iva_tasa')).toBe(true)
    expect(errors.some((e) => e.line === 5 && e.column === 'precio_venta')).toBe(true)
  })
})

describe('indexSiigoRecords', () => {
  it('rechaza header sin columnas requeridas', () => {
    const r = indexSiigoRecords(parseCsv('foo,bar\n1,2'))
    expect(r.ok).toBe(false)
  })

  it('acepta header en cualquier case y con espacios', () => {
    const r = indexSiigoRecords(
      parseCsv(' Nombre , SKU , CODIGO_BARRAS , Categoria , Tipo , Unidad , Precio_Venta , Costo , IVA_Tasa , Stock_Inicial \nWhey,WHY-1,,,,,1000,,0,0'),
    )
    expect(r.ok).toBe(true)
    if (r.ok) {
      const parsed = parseSiigoRow(r.value[0])
      expect(parsed.ok).toBe(true)
    }
  })

  it('ignora columnas extra', () => {
    const r = indexSiigoRecords(
      parseCsv(`${HEADER},extra\nWhey,WHY-1,,,,,1000,,0,0,basura`),
    )
    expect(r.ok).toBe(true)
    if (r.ok) expect(parseSiigoRow(r.value[0]).ok).toBe(true)
  })
})
