#!/usr/bin/env node
import { createHash, randomUUID } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT, sql, supabaseStatus } from './common.mjs'

const status = supabaseStatus()
if (!status.DB_URL) throw new Error('Supabase local no esta iniciado')

const batchId = randomUUID()
sql(status.DB_URL, `
  update public.offline_change_log
  set export_batch_id = '${batchId}', exported_at = now()
  where synced_at is null and export_batch_id is null;
`)

const lines = sql(status.DB_URL, `
  select jsonb_build_object(
    'id', id,
    'deviceId', device_id,
    'table', table_name,
    'operation', operation,
    'recordKey', record_key,
    'row', row_data,
    'actorUserId', actor_user_id,
    'changedAt', changed_at
  )::text
  from public.offline_change_log
  where export_batch_id = '${batchId}'
  order by changed_at, id;
`)

if (!lines) {
  console.log('No hay cambios locales pendientes para exportar.')
  process.exit(0)
}

const runtimeJson = sql(status.DB_URL, `
  select jsonb_build_object(
    'deviceId', device_id,
    'localUserId', local_user_id,
    'localUserEmail', local_user_email
  )::text
  from public.offline_runtime
  where singleton = true;
`)
const content = `${lines}\n`
const checksum = createHash('sha256').update(content).digest('hex')
const directory = join(ROOT, '.offline-sync', 'exports', batchId)
mkdirSync(directory, { recursive: true })
writeFileSync(join(directory, 'changes.jsonl'), content)
writeFileSync(
  join(directory, 'manifest.json'),
  JSON.stringify(
    {
      version: 1,
      batchId,
      createdAt: new Date().toISOString(),
      changeCount: lines.split('\n').length,
      sha256: checksum,
      runtime: JSON.parse(runtimeJson),
      status: 'exported',
    },
    null,
    2,
  ) + '\n',
)

console.log(`Lote exportado en ${directory}`)
console.log(`Cambios: ${lines.split('\n').length}`)
console.log(`SHA-256: ${checksum}`)
