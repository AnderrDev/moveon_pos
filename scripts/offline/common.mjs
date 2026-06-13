import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export const ROOT = new URL('../..', import.meta.url).pathname.replace(/\/$/, '')
export const DEMO_STORE_ID = '00000000-0000-0000-0000-000000000001'

export function parseEnvFile(path) {
  if (!existsSync(path)) return {}
  const values = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const separator = trimmed.indexOf('=')
    if (separator < 1) continue
    const key = trimmed.slice(0, separator).trim()
    let value = trimmed.slice(separator + 1).trim()
    if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1)
    values[key] = value
  }
  return values
}

export function offlineEnv() {
  return {
    ...parseEnvFile(join(ROOT, '.env.offline')),
    ...process.env,
  }
}

export function remoteEnv() {
  return {
    ...parseEnvFile(join(ROOT, '.env.local')),
    ...process.env,
  }
}

export function supabaseStatus() {
  const output = execFileSync('supabase', ['status', '-o', 'env'], {
    cwd: ROOT,
    encoding: 'utf8',
  })
  return parseEnvText(output)
}

function parseEnvText(content) {
  const values = {}
  for (const line of content.split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (!match) continue
    values[match[1]] = match[2].replace(/^"|"$/g, '')
  }
  return values
}

export function sql(dbUrl, query) {
  return execFileSync('psql', [dbUrl, '-v', 'ON_ERROR_STOP=1', '-At', '-c', query], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  }).trim()
}

export function required(value, message) {
  if (!value) throw new Error(message)
  return value
}
