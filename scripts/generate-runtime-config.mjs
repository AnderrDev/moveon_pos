#!/usr/bin/env node
/**
 * Genera runtime-config.json para cada app Angular del workspace (pos-angular
 * y landing-web) a partir de .env.local. Los archivos NO se committean — cada
 * app lo carga al bootstrap.
 *
 * Acepta tanto las variables nuevas (SUPABASE_URL) como las legacy de Next
 * (NEXT_PUBLIC_SUPABASE_URL) para compatibilidad con el .env.local existente.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const ENV_FILE = join(ROOT, '.env.local')

const OUTPUTS = [
  { path: join(ROOT, 'apps/pos-angular/public/runtime-config.json'), appNameKey: 'APP_NAME', appNameDefault: 'MOVEONAPP POS' },
  { path: join(ROOT, 'apps/landing-web/public/runtime-config.json'), appNameKey: 'LANDING_APP_NAME', appNameDefault: 'Move On Nutrition — Catálogo' },
]

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
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    env[key] = value
  }
  return env
}

const env = { ...parseEnvFile(ENV_FILE), ...process.env }

const supabaseUrl =
  env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey =
  env.SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const sentryDsn = env.SENTRY_DSN || ''
const environment = env.APP_ENV || env.NODE_ENV || 'development'

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[runtime-config] Faltan SUPABASE_URL / SUPABASE_ANON_KEY en .env.local')
  console.error('[runtime-config] Copia .env.example a .env.local y completa los valores.')
  process.exit(1)
}

for (const { path, appNameKey, appNameDefault } of OUTPUTS) {
  const appName = env[appNameKey] || appNameDefault
  const config = { supabaseUrl, supabaseAnonKey, appName, environment }
  if (sentryDsn) config.sentryDsn = sentryDsn

  writeFileSync(path, JSON.stringify(config, null, 2) + '\n')
  console.log(`[runtime-config] escrito en ${path}`)
}
