#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { DEMO_STORE_ID, ROOT, remoteEnv, required, sql, supabaseStatus } from './common.mjs'

const batchDirectory = resolve(process.argv[2] || '')
if (!process.argv[2] || !existsSync(join(batchDirectory, 'manifest.json'))) {
  console.error('Uso: pnpm offline:sync -- .offline-sync/exports/<batch-id>')
  process.exit(1)
}

const manifestPath = join(batchDirectory, 'manifest.json')
const changesPath = join(batchDirectory, 'changes.jsonl')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const content = readFileSync(changesPath, 'utf8')
const checksum = createHash('sha256').update(content).digest('hex')
if (checksum !== manifest.sha256) throw new Error('El checksum del lote no coincide')

const env = remoteEnv()
const remoteUrl = required(env.SUPABASE_URL, 'Falta SUPABASE_URL en .env.local')
const serviceRoleKey = required(
  env.SUPABASE_SERVICE_ROLE_KEY,
  'Falta SUPABASE_SERVICE_ROLE_KEY en .env.local',
)
const client = createClient(remoteUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const changes = content.trim().split('\n').map((line) => JSON.parse(line))
const storeIds = new Set(
  changes.map((change) => change.row?.tienda_id).filter(Boolean),
)
if (storeIds.has(DEMO_STORE_ID)) {
  throw new Error('El lote usa la tienda demo. Configura OFFLINE_TIENDA_ID con el UUID remoto real.')
}

const email = required(manifest.runtime?.localUserEmail, 'El lote no identifica al usuario local')
const remoteUser = await findRemoteUserByEmail(client, email)
if (!remoteUser) throw new Error(`No existe un usuario remoto con el correo ${email}`)

const userColumns = new Set(['opened_by', 'closed_by', 'created_by', 'cashier_id', 'voided_by', 'user_id'])
const localUserId = manifest.runtime.localUserId

for (const change of changes) {
  const table = change.table
  const row = change.row ? { ...change.row } : null
  if (row) {
    for (const column of userColumns) {
      if (row[column] === localUserId) row[column] = remoteUser.id
    }
  }

  if (change.operation === 'DELETE') {
    const [[key, value]] = Object.entries(change.recordKey)
    const { error } = await client.from(table).delete().eq(key, value)
    if (error) throw new Error(`${table} DELETE: ${error.message}`)
    continue
  }

  const { error } = await client.from(table).upsert(row)
  if (error) throw new Error(`${table} ${change.operation}: ${error.message}`)
}

manifest.status = 'synced'
manifest.syncedAt = new Date().toISOString()
manifest.remoteUrl = remoteUrl
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')

try {
  const localStatus = supabaseStatus()
  if (localStatus.DB_URL) {
    sql(localStatus.DB_URL, `
      update public.offline_change_log
      set synced_at = now()
      where export_batch_id = '${manifest.batchId}';
    `)
  }
} catch {
  console.warn('El lote subio, pero Supabase local no estaba disponible para marcarlo como sincronizado.')
}

console.log(`Lote ${basename(batchDirectory)} sincronizado: ${changes.length} cambios.`)

async function findRemoteUserByEmail(supabase, targetEmail) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    const found = data.users.find((user) => user.email?.toLowerCase() === targetEmail.toLowerCase())
    if (found) return found
    if (data.users.length < 1000) return null
  }
  return null
}
