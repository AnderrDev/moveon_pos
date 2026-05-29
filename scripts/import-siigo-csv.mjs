#!/usr/bin/env node
/**
 * Importador CSV de Siigo → Supabase (PLAN-18).
 *
 * Orquestador delgado: posee el I/O, la lectura de `.env.local` y el cliente
 * Supabase con SERVICE ROLE. Toda la lógica de parseo/validación/mapeo vive en
 * el módulo puro `src/modules/products/import/siigo-csv.ts` (cero secretos,
 * cero deps Node/Supabase), que aquí se transpila con esbuild y se importa.
 *
 * Uso:
 *   node scripts/import-siigo-csv.mjs <ruta-csv> [--tienda-id <uuid>] \
 *        [--created-by <uuid>] [--dry-run]
 *
 * - `--dry-run`: valida y reporta (incluye lecturas para detectar duplicados),
 *                NO escribe.
 * - Sin `--dry-run`: solo aplica si la validación no arroja errores.
 *
 * Secretos: el service role se lee de `.env.local` (`SUPABASE_SERVICE_ROLE_KEY`).
 * La URL se lee de `SUPABASE_URL` con fallback a `NEXT_PUBLIC_SUPABASE_URL`.
 * Nunca se hardcodean valores.
 */

import { readFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { build } from 'esbuild'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const ENV_FILE = join(ROOT, '.env.local')
const SRC_DIR = join(ROOT, 'src')
const PURE_MODULE = join(SRC_DIR, 'modules/products/import/siigo-csv.ts')

const DEFAULT_TIENDA_ID = 'a1b2c3d4-0000-0000-0000-000000000001'
const BATCH_SIZE = 100

// ─── .env.local loader (mismo patrón que generate-runtime-config.mjs) ─────────

function parseEnvFile(path) {
  if (!existsSync(path)) return {}
  const content = readFileSync(path, 'utf8')
  const env = {}
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    const key = trimmed.slice(0, idx).trim()
    let value = trimmed.slice(idx + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    env[key] = value
  }
  return env
}

// ─── Carga del módulo puro (transpila TS + resuelve alias @/) ─────────────────

async function loadSiigoModule() {
  const result = await build({
    entryPoints: [PURE_MODULE],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
    target: 'node20',
    // Resuelve los imports absolutos `@/...` del módulo puro hacia `src/`.
    alias: { '@': SRC_DIR },
    logLevel: 'silent',
  })
  const code = result.outputFiles[0].text
  const dataUrl = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
  return import(dataUrl)
}

// ─── Args ─────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { csvPath: null, tiendaId: DEFAULT_TIENDA_ID, createdBy: null, dryRun: false }
  const positional = []
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--dry-run') {
      args.dryRun = true
    } else if (a === '--tienda-id') {
      args.tiendaId = argv[++i]
    } else if (a === '--created-by') {
      args.createdBy = argv[++i]
    } else if (a.startsWith('--')) {
      fail(`Argumento desconocido: ${a}`)
    } else {
      positional.push(a)
    }
  }
  args.csvPath = positional[0] ?? null
  return args
}

// ─── Helpers de salida ──────────────────────────────────────────────────────

function fail(message) {
  console.error(`\n❌ ${message}\n`)
  process.exit(1)
}

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2))

  if (!args.csvPath) {
    fail(
      'Falta la ruta del CSV.\n' +
        'Uso: node scripts/import-siigo-csv.mjs <ruta-csv> [--tienda-id <uuid>] [--created-by <uuid>] [--dry-run]',
    )
  }

  const csvPath = resolve(process.cwd(), args.csvPath)
  if (!existsSync(csvPath)) fail(`No existe el archivo CSV: ${csvPath}`)

  console.log(`Tienda: ${args.tiendaId}`)
  console.log(`Modo:   ${args.dryRun ? 'DRY-RUN (no escribe)' : 'APLICAR'}`)
  console.log(`CSV:    ${csvPath}\n`)

  // 1. Parsear + validar SIEMPRE primero (módulo puro).
  const mod = await loadSiigoModule()
  const csvText = readFileSync(csvPath, 'utf8')

  const indexed = mod.indexSiigoRecords(mod.parseCsv(csvText))
  if (!indexed.ok) {
    for (const e of indexed.error) reportError(e)
    fail('El header del CSV es inválido. No se escribió nada.')
  }

  const { valid, errors } = mod.validateSiigoRows(indexed.value)

  if (errors.length > 0) {
    console.error(`Se encontraron ${errors.length} error(es) de validación:\n`)
    for (const e of errors.sort((a, b) => a.line - b.line)) reportError(e)
    fail(`Validación fallida (${errors.length} error(es)). No se escribió nada.`)
  }

  console.log(`✅ Validación OK: ${valid.length} fila(s) válida(s).\n`)

  // 2. Conexión Supabase (necesaria incluso en dry-run para detectar duplicados).
  const env = { ...parseEnvFile(ENV_FILE), ...process.env }
  const supabaseUrl = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || ''
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || ''

  if (!supabaseUrl) {
    fail('Falta SUPABASE_URL (o NEXT_PUBLIC_SUPABASE_URL) en .env.local.')
  }
  if (!serviceKey) {
    fail('Falta SUPABASE_SERVICE_ROLE_KEY en .env.local.')
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // 3. Resolver created_by (NOT NULL).
  let createdBy = args.createdBy
  if (!createdBy) {
    const { data, error } = await supabase
      .from('user_tiendas')
      .select('user_id')
      .eq('tienda_id', args.tiendaId)
      .eq('rol', 'admin')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()
    if (error) fail(`Error consultando admin de la tienda: ${error.message}`)
    if (!data) {
      fail(
        'No se encontró un admin activo para la tienda y no se pasó --created-by.\n' +
          'inventory_movements.created_by es NOT NULL: aborta para no usar un uuid falso.',
      )
    }
    createdBy = data.user_id
  }
  console.log(`created_by (movimientos): ${createdBy}\n`)

  // 4. Detectar duplicados existentes (sku / codigo_barras) en la tienda.
  const skus = valid.map((r) => r.sku).filter((s) => s != null)
  const barcodes = valid.map((r) => r.codigoBarras).filter((s) => s != null)

  const existingSkus = await fetchExistingValues(supabase, args.tiendaId, 'sku', skus)
  const existingBarcodes = await fetchExistingValues(
    supabase,
    args.tiendaId,
    'codigo_barras',
    barcodes,
  )

  const newRows = []
  const skipped = []
  for (const row of valid) {
    const skuHit = row.sku != null && existingSkus.has(row.sku)
    const barcodeHit = row.codigoBarras != null && existingBarcodes.has(row.codigoBarras)
    if (skuHit || barcodeHit) {
      const reason = skuHit ? `SKU ${row.sku}` : `código de barras ${row.codigoBarras}`
      skipped.push({ row, reason })
    } else {
      newRows.push(row)
    }
  }

  // 5. Categorías: insertar solo faltantes por (tienda_id, nombre).
  const categoryNames = [
    ...new Set(newRows.map((r) => r.categoria).filter((c) => c != null)),
  ]
  const categoryIdByName = await resolveCategories(
    supabase,
    args.tiendaId,
    categoryNames,
    args.dryRun,
  )

  const movementsCount = newRows.filter((r) => r.stockInicial > 0).length

  // 6. Reporte de duplicados omitidos.
  if (skipped.length > 0) {
    console.log('Duplicados omitidos (no se sobrescriben):')
    for (const s of skipped) {
      console.log(`  - línea ${s.row.lineNumber}: "${s.row.nombre}" (${s.reason})`)
    }
    console.log('')
  }

  // 7. Resumen.
  const newCategoriesCount = [...categoryIdByName.values()].filter((v) => v.isNew).length
  console.log('Resumen:')
  console.log(`  ${newCategoriesCount} categorías nuevas`)
  console.log(`  ${newRows.length} productos nuevos`)
  console.log(`  ${skipped.length} duplicados omitidos`)
  console.log(`  ${movementsCount} movimientos de stock inicial`)
  console.log('')

  if (args.dryRun) {
    console.log('DRY-RUN: no se escribió nada en la base de datos.')
    return
  }

  // 8. APLICAR — orden: categorías → productos → movimientos.
  await applyCategories(supabase, args.tiendaId, categoryIdByName)
  const productoIdByLine = await applyProducts(
    supabase,
    mod,
    args.tiendaId,
    newRows,
    categoryIdByName,
  )
  await applyMovements(supabase, mod, args.tiendaId, newRows, productoIdByLine, createdBy)

  console.log('\n✅ Importación aplicada correctamente.')
}

// ─── Lecturas ─────────────────────────────────────────────────────────────────

async function fetchExistingValues(supabase, tiendaId, column, values) {
  const found = new Set()
  if (values.length === 0) return found
  for (const part of chunk(values, BATCH_SIZE)) {
    const { data, error } = await supabase
      .from('productos')
      .select(column)
      .eq('tienda_id', tiendaId)
      .in(column, part)
    if (error) fail(`Error consultando productos por ${column}: ${error.message}`)
    for (const r of data ?? []) {
      if (r[column] != null) found.add(r[column])
    }
  }
  return found
}

async function resolveCategories(supabase, tiendaId, names, dryRun) {
  // Map nombre → { id, isNew }. id es null cuando aún no se ha insertado (dry-run).
  const map = new Map()
  if (names.length === 0) return map

  const { data, error } = await supabase
    .from('categorias')
    .select('id, nombre')
    .eq('tienda_id', tiendaId)
    .in('nombre', names)
  if (error) fail(`Error consultando categorías: ${error.message}`)

  const existingByName = new Map((data ?? []).map((c) => [c.nombre, c.id]))
  for (const name of names) {
    if (existingByName.has(name)) {
      map.set(name, { id: existingByName.get(name), isNew: false })
    } else {
      map.set(name, { id: null, isNew: true })
    }
  }
  return map
}

// ─── Escrituras ───────────────────────────────────────────────────────────────

async function applyCategories(supabase, tiendaId, categoryIdByName) {
  const toInsert = [...categoryIdByName.entries()]
    .filter(([, v]) => v.isNew)
    .map(([nombre]) => ({ tienda_id: tiendaId, nombre }))
  if (toInsert.length === 0) return

  for (const part of chunk(toInsert, BATCH_SIZE)) {
    const { data, error } = await supabase
      .from('categorias')
      .insert(part)
      .select('id, nombre')
    if (error) fail(`Error insertando categorías (detente y revisa lo ya escrito): ${error.message}`)
    for (const c of data ?? []) {
      const entry = categoryIdByName.get(c.nombre)
      if (entry) entry.id = c.id
    }
  }
  console.log(`  → ${toInsert.length} categoría(s) insertada(s).`)
}

async function applyProducts(supabase, mod, tiendaId, newRows, categoryIdByName) {
  const productoIdByLine = new Map()
  if (newRows.length === 0) return productoIdByLine

  for (const part of chunk(newRows, BATCH_SIZE)) {
    const payloads = part.map((row) => {
      const categoriaId =
        row.categoria != null ? (categoryIdByName.get(row.categoria)?.id ?? null) : null
      const insert = mod.toProductInsert(row, tiendaId, categoriaId)
      return { ...insert, __line: row.lineNumber }
    })
    // Quitar el campo auxiliar antes de insertar.
    const clean = payloads.map(({ __line, ...rest }) => rest)
    const { data, error } = await supabase
      .from('productos')
      .insert(clean)
      .select('id, nombre, sku')
    if (error) fail(`Error insertando productos (detente y revisa lo ya escrito): ${error.message}`)
    // Reasociar id ↔ línea por orden (insert preserva el orden de entrada).
    const inserted = data ?? []
    part.forEach((row, idx) => {
      const rec = inserted[idx]
      if (rec) productoIdByLine.set(row.lineNumber, rec.id)
    })
  }
  console.log(`  → ${newRows.length} producto(s) insertado(s).`)
  return productoIdByLine
}

async function applyMovements(supabase, mod, tiendaId, newRows, productoIdByLine, createdBy) {
  const movements = []
  for (const row of newRows) {
    if (row.stockInicial <= 0) continue
    const productoId = productoIdByLine.get(row.lineNumber)
    if (!productoId) {
      fail(`No se resolvió el id del producto de la línea ${row.lineNumber}; detente.`)
    }
    movements.push(mod.toEntryMovement(row, productoId, tiendaId, createdBy))
  }
  if (movements.length === 0) return

  for (const part of chunk(movements, BATCH_SIZE)) {
    const { error } = await supabase.from('inventory_movements').insert(part)
    if (error) fail(`Error insertando movimientos (detente y revisa lo ya escrito): ${error.message}`)
  }
  console.log(`  → ${movements.length} movimiento(s) de stock inicial insertado(s).`)
}

// ─── Reporte de errores ─────────────────────────────────────────────────────

function reportError(e) {
  const col = e.column ? ` [${e.column}]` : ''
  console.error(`  línea ${e.line}${col}: ${e.message}`)
}

main().catch((error) => {
  console.error('\n❌ Fallo técnico:', error?.message ?? error)
  process.exit(1)
})
