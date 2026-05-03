#!/usr/bin/env node
/**
 * Genera apps/pos-angular/public/runtime-config.json a partir de .env.local
 * El archivo NO se committea — la app lo carga al bootstrap.
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
const OUTPUT = join(ROOT, 'apps/pos-angular/public/runtime-config.json')

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
const appName = env.APP_NAME || 'MOVEONAPP POS'

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[runtime-config] Faltan SUPABASE_URL / SUPABASE_ANON_KEY en .env.local')
  console.error('[runtime-config] Copia .env.example a .env.local y completa los valores.')
  process.exit(1)
}

const config = { supabaseUrl, supabaseAnonKey, appName }
writeFileSync(OUTPUT, JSON.stringify(config, null, 2) + '\n')
console.log(`[runtime-config] escrito en ${OUTPUT}`)
