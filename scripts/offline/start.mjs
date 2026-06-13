#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { DEMO_STORE_ID, ROOT, offlineEnv, sql, supabaseStatus } from './common.mjs'

const env = offlineEnv()
const email = env.OFFLINE_ADMIN_EMAIL || 'admin@moveon.local'
const password = env.OFFLINE_ADMIN_PASSWORD || 'MoveonLocal123!'
const tiendaId = env.OFFLINE_TIENDA_ID || DEMO_STORE_ID
const tiendaName = env.OFFLINE_TIENDA_NAME || 'MOVEONAPP Tienda Local'

execFileSync('supabase', ['start'], { cwd: ROOT, stdio: 'inherit' })
const status = supabaseStatus()
const apiUrl = status.API_URL
const anonKey = status.ANON_KEY
const serviceRoleKey = status.SERVICE_ROLE_KEY
const dbUrl = status.DB_URL

if (!apiUrl || !anonKey || !serviceRoleKey || !dbUrl) {
  throw new Error('Supabase local no devolvio API_URL, ANON_KEY, SERVICE_ROLE_KEY y DB_URL')
}

const client = createClient(apiUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const { data: usersPage, error: listError } = await client.auth.admin.listUsers({ perPage: 1000 })
if (listError) throw listError

let user = usersPage.users.find((candidate) => candidate.email?.toLowerCase() === email.toLowerCase())
if (!user) {
  const { data, error } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre: 'Administrador local' },
  })
  if (error) throw error
  user = data.user
}

const escapedName = tiendaName.replaceAll("'", "''")
const escapedEmail = email.replaceAll("'", "''")
sql(dbUrl, `
  insert into public.tiendas (id, nombre)
  values ('${tiendaId}', '${escapedName}')
  on conflict (id) do update set nombre = excluded.nombre;

  insert into public.user_tiendas (user_id, tienda_id, rol, is_active)
  values ('${user.id}', '${tiendaId}', 'admin', true)
  on conflict (user_id, tienda_id) do update set rol = 'admin', is_active = true;

  update public.offline_runtime
  set enabled = true,
      local_user_id = '${user.id}',
      local_user_email = '${escapedEmail}',
      updated_at = now()
  where singleton = true;
`)

mkdirSync(join(ROOT, '.offline'), { recursive: true })
mkdirSync(join(ROOT, '.offline-sync', 'exports'), { recursive: true })
writeFileSync(
  join(ROOT, '.offline', 'runtime.env'),
  [
    `SUPABASE_URL=${apiUrl}`,
    `SUPABASE_ANON_KEY=${anonKey}`,
    'APP_NAME=MOVEONAPP POS LOCAL',
    'APP_ENV=offline',
    '',
  ].join('\n'),
)

console.log('\nModo local listo.')
console.log(`URL: ${apiUrl}`)
console.log(`Usuario: ${email}`)
console.log(`Contrasena: ${password}`)
console.log(`Tienda: ${tiendaId}`)
console.log('Ejecuta: pnpm offline:dev')
