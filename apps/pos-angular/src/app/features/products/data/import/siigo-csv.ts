/**
 * Módulo puro (TS, sin Angular/Supabase/Node) para importar un CSV de Siigo.
 *
 * Responsabilidades (SRP):
 *  - `parseCsv`     → parser CSV mínimo RFC-4180-ish (comillas, comas embebidas,
 *                     `""` escapado, `\r\n`, BOM, línea final en blanco).
 *  - `parseSiigoRow`→ valida una fila (Zod en el borde) → `Result<SiigoProductRow, SiigoRowError[]>`.
 *  - `validateSiigoRows` → valida todas las filas (per-row + unicidad cross-row).
 *  - `toProductInsert` / `toEntryMovement` → mappers a payloads de inserción.
 *
 * No importa `database.types.ts`: define interfaces "narrow" y reusa los tipos
 * de dominio de `@/shared/types`. La conexión a Supabase y el service role viven
 * únicamente en el script `scripts/import-siigo-csv.mjs`.
 */

import { err, ok, type Result } from '@/shared/result'
import type { InventoryLocation, IvaRate, ProductType } from '@/shared/types'
import {
  entityNameSchema,
  ivaRateSchema,
  productTypeSchema,
  salePriceSchema,
  skuSchema,
  stockQuantitySchema,
} from '@/shared/validations/common'

// ─── Tipos públicos ─────────────────────────────────────────────────────────

/** Fila válida de Siigo, ya normalizada y lista para mapear a inserts. */
export interface SiigoProductRow {
  /** Número de línea del CSV (1-based, incluye el header en el conteo). */
  lineNumber: number
  nombre: string
  /** SKU en mayúsculas, o `undefined` si la celda venía vacía. */
  sku: string | undefined
  codigoBarras: string | undefined
  /** Nombre de categoría tal cual (sin id); `undefined` → producto sin categoría. */
  categoria: string | undefined
  tipo: ProductType
  unidad: string
  /** Precio de venta en pesos colombianos (entero, sin centavos). */
  precioVenta: number
  /** Costo en pesos colombianos (entero) o `undefined` si no se informó. */
  costo: number | undefined
  ivaTasa: IvaRate
  /** Stock inicial (entero ≥ 0). 0 → no genera movimiento de entrada. */
  stockInicial: number
}

/** Error asociado a una fila/columna específica del CSV. */
export interface SiigoRowError {
  /** Línea del CSV (1-based) donde ocurre el error. */
  line: number
  /** Columna del header afectada, o `null` si es un error de fila completa. */
  column: string | null
  /** Mensaje en español. */
  message: string
}

/** Resultado de validar el archivo completo. */
export interface ValidateSiigoResult {
  valid: SiigoProductRow[]
  errors: SiigoRowError[]
}

/** Payload de inserción de un producto (narrow, sin tipos de Supabase). */
export interface ProductInsert {
  tienda_id: string
  categoria_id: string | null
  nombre: string
  sku: string | null
  codigo_barras: string | null
  tipo: ProductType
  unidad: string
  precio_venta: number
  costo: number | null
  iva_tasa: IvaRate
}

/** Payload de inserción de un movimiento de inventario de tipo `entry`. */
export interface EntryMovementInsert {
  tienda_id: string
  producto_id: string
  tipo: 'entry'
  ubicacion: InventoryLocation
  cantidad: number
  costo_unitario: number | null
  motivo: string
  referencia_tipo: string
  created_by: string
}

/** Motivo estándar del movimiento de stock inicial de la migración. */
const SIIGO_ENTRY_MOTIVO = 'Stock inicial migración Siigo'

/** Etiqueta de `referencia_tipo` para los movimientos de esta importación. */
const SIIGO_REFERENCIA_TIPO = 'siigo_import'

/** El stock inicial de Siigo entra a bodega; se traslada a PV para vender. */
const SIIGO_ENTRY_UBICACION: InventoryLocation = 'bodega'

/** Columnas esperadas en el header (orden canónico, case-insensitive). */
const SIIGO_HEADER_COLUMNS = [
  'nombre',
  'sku',
  'codigo_barras',
  'categoria',
  'tipo',
  'unidad',
  'precio_venta',
  'costo',
  'iva_tasa',
  'stock_inicial',
] as const

type SiigoColumn = (typeof SIIGO_HEADER_COLUMNS)[number]

/** Registro de una fila ya indexado por nombre de columna. */
export interface SiigoRecord {
  /** Número de línea del CSV (1-based). */
  lineNumber: number
  /** Celdas indexadas por nombre de columna normalizado. */
  cells: Partial<Record<SiigoColumn, string>>
}

// ─── parseCsv ─────────────────────────────────────────────────────────────────

/**
 * Parser CSV mínimo RFC-4180-ish.
 *
 * - Respeta comillas dobles: comas y saltos de línea embebidos.
 * - `""` dentro de un campo entrecomillado → comilla literal.
 * - Acepta `\r\n` y `\n` como fin de línea.
 * - Elimina el BOM inicial si está presente.
 * - Ignora una única línea final en blanco (terminación con `\n`).
 *
 * @returns Matriz de filas; cada fila es un arreglo de celdas (strings).
 */
export function parseCsv(text: string): string[][] {
  // Quitar BOM.
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text

  const rows: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false
  let i = 0
  const n = input.length

  while (i < n) {
    const ch = input[i]

    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i += 1
        continue
      }
      field += ch
      i += 1
      continue
    }

    if (ch === '"') {
      inQuotes = true
      i += 1
      continue
    }
    if (ch === ',') {
      row.push(field)
      field = ''
      i += 1
      continue
    }
    if (ch === '\r') {
      // Tratar \r\n como un solo fin de línea.
      if (input[i + 1] === '\n') i += 1
      row.push(field)
      rows.push(row)
      field = ''
      row = []
      i += 1
      continue
    }
    if (ch === '\n') {
      row.push(field)
      rows.push(row)
      field = ''
      row = []
      i += 1
      continue
    }

    field += ch
    i += 1
  }

  // Última fila pendiente (sin salto de línea final).
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  // Ignorar una única línea final en blanco (una sola celda vacía).
  if (rows.length > 0) {
    const last = rows[rows.length - 1]
    if (last.length === 1 && last[0] === '') rows.pop()
  }

  return rows
}

// ─── Header + indexación de filas ───────────────────────────────────────────

function normalizeHeaderCell(cell: string): string {
  return cell.trim().toLowerCase()
}

/**
 * Indexa las filas de datos por nombre de columna a partir del header.
 *
 * @returns `Result` con los registros indexados, o un `SiigoRowError` si faltan
 *          columnas requeridas en el header.
 */
export function indexSiigoRecords(
  rows: string[][],
): Result<SiigoRecord[], SiigoRowError[]> {
  if (rows.length === 0) {
    return err([{ line: 1, column: null, message: 'El archivo CSV está vacío' }])
  }

  const header = rows[0].map(normalizeHeaderCell)
  const required: SiigoColumn[] = ['nombre', 'precio_venta', 'iva_tasa']
  const missing = required.filter((col) => !header.includes(col))
  if (missing.length > 0) {
    return err([
      {
        line: 1,
        column: null,
        message: `Faltan columnas requeridas en el header: ${missing.join(', ')}`,
      },
    ])
  }

  // Mapa columna→índice (solo columnas conocidas; las extra se ignoran).
  const colIndex = new Map<SiigoColumn, number>()
  for (const col of SIIGO_HEADER_COLUMNS) {
    const idx = header.indexOf(col)
    if (idx !== -1) colIndex.set(col, idx)
  }

  const records: SiigoRecord[] = []
  for (let r = 1; r < rows.length; r += 1) {
    const raw = rows[r]
    const cells: Partial<Record<SiigoColumn, string>> = {}
    for (const [col, idx] of colIndex) {
      cells[col] = raw[idx] ?? ''
    }
    records.push({ lineNumber: r + 1, cells })
  }

  return ok(records)
}

// ─── Parseo de valores COP ──────────────────────────────────────────────────

/**
 * Parsea un monto en pesos colombianos a entero (sin centavos).
 *
 * Acepta separador de miles con punto (`110.000`). Rechaza decimales/centavos:
 * una coma con dígitos, o un punto seguido de un número de dígitos ≠ 3.
 *
 * @returns `Result` con el entero, o un mensaje de error.
 */
export function parseCop(raw: string): Result<number, string> {
  const cleaned = raw.replace(/\$/g, '').replace(/\s+/g, '').trim()
  if (cleaned === '') return err('valor vacío')

  // Comas → separador decimal en formato COP; con dígitos detrás son centavos.
  if (cleaned.includes(',')) {
    return err('no se admiten centavos (usa pesos enteros)')
  }

  // Puntos: solo válidos como separador de miles (grupos de exactamente 3).
  if (cleaned.includes('.')) {
    const parts = cleaned.split('.')
    const head = parts[0]
    const groups = parts.slice(1)
    if (head === '' || !/^[0-9]+$/.test(head) || head.length > 3) {
      return err('formato de miles inválido')
    }
    for (const g of groups) {
      if (!/^[0-9]{3}$/.test(g)) {
        return err('no se admiten centavos (usa pesos enteros)')
      }
    }
  } else if (!/^[0-9]+$/.test(cleaned)) {
    return err('valor numérico inválido')
  }

  const digits = cleaned.replace(/\./g, '')
  const value = Number(digits)
  if (!Number.isInteger(value)) return err('valor numérico inválido')
  return ok(value)
}

/**
 * Parsea un entero simple (stock). Rechaza decimales y valores no numéricos.
 */
function parseInteger(raw: string): Result<number, string> {
  const cleaned = raw.trim()
  if (!/^-?[0-9]+$/.test(cleaned)) return err('debe ser un número entero')
  const value = Number(cleaned)
  if (!Number.isInteger(value)) return err('debe ser un número entero')
  return ok(value)
}

// ─── parseSiigoRow ────────────────────────────────────────────────────────────

function cell(record: SiigoRecord, col: SiigoColumn): string {
  return (record.cells[col] ?? '').trim()
}

/**
 * Valida y normaliza una fila de Siigo.
 *
 * @returns `Result` con la fila normalizada, o la lista de errores de la fila.
 */
export function parseSiigoRow(
  record: SiigoRecord,
): Result<SiigoProductRow, SiigoRowError[]> {
  const line = record.lineNumber
  const errors: SiigoRowError[] = []
  const push = (column: SiigoColumn | null, message: string): void => {
    errors.push({ line, column, message })
  }

  // nombre (req 2–100).
  const nombreRaw = cell(record, 'nombre')
  let nombre = ''
  const nombreParsed = entityNameSchema.safeParse(nombreRaw)
  if (!nombreParsed.success) {
    push('nombre', nombreParsed.error.issues[0]?.message ?? 'nombre inválido')
  } else {
    nombre = nombreParsed.data
  }

  // sku (opcional, upper, skuSchema).
  const skuRaw = cell(record, 'sku')
  let sku: string | undefined
  if (skuRaw !== '') {
    const skuParsed = skuSchema.safeParse(skuRaw.toUpperCase())
    if (!skuParsed.success) {
      push('sku', skuParsed.error.issues[0]?.message ?? 'SKU inválido')
    } else {
      sku = skuParsed.data
    }
  }

  // codigo_barras (opcional, texto libre).
  const codigoBarrasRaw = cell(record, 'codigo_barras')
  const codigoBarras = codigoBarrasRaw === '' ? undefined : codigoBarrasRaw

  // categoria (opcional).
  const categoriaRaw = cell(record, 'categoria')
  const categoria = categoriaRaw === '' ? undefined : categoriaRaw

  // tipo (vacío→simple; otro→error).
  const tipoRaw = cell(record, 'tipo').toLowerCase()
  let tipo: ProductType = 'simple'
  if (tipoRaw !== '') {
    const tipoParsed = productTypeSchema.safeParse(tipoRaw)
    if (!tipoParsed.success) {
      push('tipo', `tipo inválido: "${tipoRaw}" (usa simple, prepared o ingredient)`)
    } else {
      tipo = tipoParsed.data
    }
  }

  // unidad (default 'und').
  const unidadRaw = cell(record, 'unidad')
  const unidad = unidadRaw === '' ? 'und' : unidadRaw

  // precio_venta (req entero > 0, formato COP).
  const precioRaw = cell(record, 'precio_venta')
  let precioVenta = 0
  if (precioRaw === '') {
    push('precio_venta', 'el precio de venta es obligatorio')
  } else {
    const copParsed = parseCop(precioRaw)
    if (!copParsed.ok) {
      push('precio_venta', `precio de venta inválido (${copParsed.error})`)
    } else {
      const priceParsed = salePriceSchema.safeParse(copParsed.value)
      if (!priceParsed.success) {
        push('precio_venta', priceParsed.error.issues[0]?.message ?? 'precio inválido')
      } else {
        precioVenta = priceParsed.data
      }
    }
  }

  // costo (opcional, ''→undefined, entero ≥ 0, formato COP).
  const costoRaw = cell(record, 'costo')
  let costo: number | undefined
  if (costoRaw !== '') {
    const copParsed = parseCop(costoRaw)
    if (!copParsed.ok) {
      push('costo', `costo inválido (${copParsed.error})`)
    } else if (copParsed.value < 0) {
      push('costo', 'el costo no puede ser negativo')
    } else {
      costo = copParsed.value
    }
  }

  // iva_tasa (req ∈ {0,5,19}).
  const ivaRaw = cell(record, 'iva_tasa')
  let ivaTasa: IvaRate = 0
  if (ivaRaw === '') {
    push('iva_tasa', 'la tasa de IVA es obligatoria (0, 5 o 19)')
  } else {
    const ivaInt = parseInteger(ivaRaw)
    if (!ivaInt.ok) {
      push('iva_tasa', `tasa de IVA inválida (${ivaInt.error})`)
    } else {
      const ivaParsed = ivaRateSchema.safeParse(ivaInt.value)
      if (!ivaParsed.success) {
        push('iva_tasa', `tasa de IVA inválida: ${ivaInt.value} (usa 0, 5 o 19)`)
      } else {
        ivaTasa = ivaParsed.data as IvaRate
      }
    }
  }

  // stock_inicial (opcional, vacío→0, entero ≥ 0).
  const stockRaw = cell(record, 'stock_inicial')
  let stockInicial = 0
  if (stockRaw !== '') {
    const stockInt = parseInteger(stockRaw)
    if (!stockInt.ok) {
      push('stock_inicial', `stock inicial inválido (${stockInt.error})`)
    } else {
      const stockParsed = stockQuantitySchema.safeParse(stockInt.value)
      if (!stockParsed.success) {
        push('stock_inicial', stockParsed.error.issues[0]?.message ?? 'stock inválido')
      } else {
        stockInicial = stockParsed.data
      }
    }
  }

  if (errors.length > 0) return err(errors)

  return ok({
    lineNumber: line,
    nombre,
    sku,
    codigoBarras,
    categoria,
    tipo,
    unidad,
    precioVenta,
    costo,
    ivaTasa,
    stockInicial,
  })
}

// ─── validateSiigoRows ────────────────────────────────────────────────────────

/**
 * Valida todos los registros: per-row (Zod) + unicidad cross-row de
 * `sku`, `codigo_barras` y `nombre` (este último case-insensitive).
 *
 * Los duplicados cross-row se reportan en la ocurrencia posterior, citando la
 * primera línea donde apareció el valor.
 */
export function validateSiigoRows(records: SiigoRecord[]): ValidateSiigoResult {
  const valid: SiigoProductRow[] = []
  const errors: SiigoRowError[] = []

  const seenSku = new Map<string, number>()
  const seenBarcode = new Map<string, number>()
  const seenNombre = new Map<string, number>()

  for (const record of records) {
    const parsed = parseSiigoRow(record)
    if (!parsed.ok) {
      errors.push(...parsed.error)
      continue
    }

    const row = parsed.value
    const rowErrors: SiigoRowError[] = []

    if (row.sku !== undefined) {
      const key = row.sku.toUpperCase()
      const first = seenSku.get(key)
      if (first !== undefined) {
        rowErrors.push({
          line: row.lineNumber,
          column: 'sku',
          message: `SKU duplicado "${row.sku}" (ya aparece en la línea ${first})`,
        })
      } else {
        seenSku.set(key, row.lineNumber)
      }
    }

    if (row.codigoBarras !== undefined) {
      const key = row.codigoBarras
      const first = seenBarcode.get(key)
      if (first !== undefined) {
        rowErrors.push({
          line: row.lineNumber,
          column: 'codigo_barras',
          message: `Código de barras duplicado "${row.codigoBarras}" (ya aparece en la línea ${first})`,
        })
      } else {
        seenBarcode.set(key, row.lineNumber)
      }
    }

    {
      const key = row.nombre.toLowerCase()
      const first = seenNombre.get(key)
      if (first !== undefined) {
        rowErrors.push({
          line: row.lineNumber,
          column: 'nombre',
          message: `Nombre duplicado "${row.nombre}" (ya aparece en la línea ${first})`,
        })
      } else {
        seenNombre.set(key, row.lineNumber)
      }
    }

    if (rowErrors.length > 0) {
      errors.push(...rowErrors)
      continue
    }

    valid.push(row)
  }

  return { valid, errors }
}

// ─── Mappers a payloads de inserción ──────────────────────────────────────────

/**
 * Mapea una fila válida al payload de inserción de `productos`.
 *
 * @param categoriaId  Id de categoría resuelto, o `null` si la fila no tiene categoría.
 */
export function toProductInsert(
  row: SiigoProductRow,
  tiendaId: string,
  categoriaId: string | null,
): ProductInsert {
  return {
    tienda_id: tiendaId,
    categoria_id: categoriaId,
    nombre: row.nombre,
    sku: row.sku ?? null,
    codigo_barras: row.codigoBarras ?? null,
    tipo: row.tipo,
    unidad: row.unidad,
    precio_venta: row.precioVenta,
    costo: row.costo ?? null,
    iva_tasa: row.ivaTasa,
  }
}

/**
 * Mapea una fila válida al movimiento de inventario de stock inicial (`entry`).
 *
 * RN-I02: la cantidad de un `entry` siempre es positiva. Solo se debe invocar
 * cuando `row.stockInicial > 0`.
 */
export function toEntryMovement(
  row: SiigoProductRow,
  productoId: string,
  tiendaId: string,
  createdBy: string,
): EntryMovementInsert {
  return {
    tienda_id: tiendaId,
    producto_id: productoId,
    tipo: 'entry',
    ubicacion: SIIGO_ENTRY_UBICACION,
    cantidad: row.stockInicial,
    costo_unitario: row.costo ?? null,
    motivo: SIIGO_ENTRY_MOTIVO,
    referencia_tipo: SIIGO_REFERENCIA_TIPO,
    created_by: createdBy,
  }
}
