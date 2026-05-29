#!/usr/bin/env node
// Script temporal para crear el usuario admin via Supabase Auth Admin API
// Uso: node scripts/seed-admin-user.mjs
//
// Secretos: el service role se lee de `.env.local` (`SUPABASE_SERVICE_ROLE_KEY`).
// La URL se lee de `SUPABASE_URL` con fallback a `NEXT_PUBLIC_SUPABASE_URL`.
// Nunca se hardcodean valores (CLAUDE.md §2.4).

import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const ENV_FILE = join(ROOT, '.env.local')

const TIENDA_ID = 'a1b2c3d4-0000-0000-0000-000000000001'

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

const env = { ...parseEnvFile(ENV_FILE), ...process.env }
const SUPABASE_URL = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || ''
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!SUPABASE_URL) {
  console.error('Falta SUPABASE_URL (o NEXT_PUBLIC_SUPABASE_URL) en .env.local.')
  process.exit(1)
}
if (!SERVICE_ROLE_KEY) {
  console.error('Falta SUPABASE_SERVICE_ROLE_KEY en .env.local.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function main() {
  // 1. Crear usuario via Admin API (hashea correctamente la contraseña)
  const { data, error } = await supabase.auth.admin.createUser({
    email: 'admin@moveonpos.co',
    password: 'Admin1234!',
    email_confirm: true,
    user_metadata: { nombre: 'Admin Test' },
    app_metadata: { provider: 'email', providers: ['email'] },
  })

  if (error) {
    console.error('Error creando usuario:', error.message)
    process.exit(1)
  }

  console.log('✅ Usuario creado:', data.user.id)

  // 2. Asignar a la tienda
  const { error: tiendaError } = await supabase
    .from('user_tiendas')
    .insert({
      user_id: data.user.id,
      tienda_id: TIENDA_ID,
      rol: 'admin',
      is_active: true,
    })

  if (tiendaError) {
    console.error('Error asignando tienda:', tiendaError.message)
    process.exit(1)
  }

  console.log('✅ Asignado a tienda:', TIENDA_ID)
  console.log('')
  console.log('Credenciales:')
  console.log('  Email:      admin@moveonpos.co')
  console.log('  Contraseña: Admin1234!')
}

main()
