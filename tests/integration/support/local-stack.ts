/**
 * Utilidades de las pruebas de paridad contra el Supabase LOCAL (`pnpm test:parity`).
 * Nunca apuntan a producción: `localStack` se niega si la URL no es local.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const ROOT = path.resolve(__dirname, '../../..')
export const PASSWORD = 'Paridad1234!'

export interface LocalStack {
  url: string
  anonKey: string
  serviceRoleKey: string
  dbContainer: string
}

/**
 * `supabase status` del CLI instalado en el sistema: bajo pnpm/npx el PATH
 * empieza por `node_modules/.bin`, que trae un CLI viejo que no entiende el
 * config.toml. Puede salir con código ≠ 0 si hay servicios opcionales
 * detenidos (Studio, Storage…), pero igual imprime los datos.
 */
function supabaseStatus(): string {
  const PATH = (process.env['PATH'] ?? '')
    .split(path.delimiter)
    .filter((dir) => !dir.includes(`node_modules${path.sep}.bin`))
    .join(path.delimiter)
  try {
    return execFileSync('supabase', ['status', '-o', 'env'], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PATH },
    })
  } catch (error) {
    const stdout = (error as { stdout?: string }).stdout
    if (stdout) return stdout
    throw error
  }
}

export function localStack(): LocalStack {
  const env = supabaseStatus()
  const get = (key: string): string => {
    const match = env.match(new RegExp(`^${key}="?([^"\\n]+)"?$`, 'm'))
    if (!match) throw new Error(`Falta ${key} en "supabase status": ¿está corriendo el Supabase local?`)
    return match[1]
  }
  const url = get('API_URL')
  if (!/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url)) {
    throw new Error(`La paridad solo corre contra el Supabase local, no contra ${url}`)
  }
  const projectId = readFileSync(path.join(ROOT, 'supabase/config.toml'), 'utf8').match(/^project_id\s*=\s*"([^"]+)"/m)?.[1]
  return { url, anonKey: get('ANON_KEY'), serviceRoleKey: get('SERVICE_ROLE_KEY'), dbContainer: `supabase_db_${projectId}` }
}

export function psql(stack: LocalStack, sql: string, vars: Record<string, string> = {}): void {
  const args = ['exec', '-i', stack.dbContainer, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
  for (const [key, value] of Object.entries(vars)) args.push('-v', `${key}=${value}`)
  execFileSync('docker', args, { input: sql, stdio: ['pipe', 'ignore', 'pipe'] })
}

/** Borra las tiendas de paridad (también las que dejó una corrida que falló). */
export const CLEANUP_SQL = `
  create temp table paridad_tiendas as select id from public.tiendas where nombre like 'Paridad %';
  delete from public.payments where sale_id in (select id from public.sales where tienda_id in (select id from paridad_tiendas));
  delete from public.sale_items where sale_id in (select id from public.sales where tienda_id in (select id from paridad_tiendas));
  delete from public.audit_logs where tienda_id in (select id from paridad_tiendas);
  delete from public.sales where tienda_id in (select id from paridad_tiendas);
  delete from public.inventory_movements where tienda_id in (select id from paridad_tiendas);
  delete from public.cash_movements where cash_session_id in (select id from public.cash_sessions where tienda_id in (select id from paridad_tiendas));
  delete from public.cash_sessions where tienda_id in (select id from paridad_tiendas);
  delete from public.productos where tienda_id in (select id from paridad_tiendas);
  delete from public.user_tiendas where tienda_id in (select id from paridad_tiendas);
  delete from public.tiendas where id in (select id from paridad_tiendas);
`

export async function signIn(stack: LocalStack, email: string): Promise<SupabaseClient> {
  const client = createClient(stack.url, stack.anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD })
  if (error) throw error
  return client
}

/** Crea usuarios confirmados por la API de admin de GoTrue y devuelve sus ids. */
export async function createUsers(stack: LocalStack, emails: string[]): Promise<string[]> {
  const service = createClient(stack.url, stack.serviceRoleKey, { auth: { persistSession: false } })
  const ids: string[] = []
  for (const email of emails) {
    const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
    if (error) throw error
    ids.push(data.user.id)
  }
  return ids
}

export async function deleteUsers(stack: LocalStack, ids: string[]): Promise<void> {
  const service = createClient(stack.url, stack.serviceRoleKey, { auth: { persistSession: false } })
  for (const id of ids) await service.auth.admin.deleteUser(id)
}

/** Números a 6 decimales (float del TS vs numeric de Postgres) y sin las claves indicadas. */
export function normalize(value: unknown, dropKeys: readonly string[] = []): unknown {
  if (typeof value === 'number') return Math.round(value * 1e6) / 1e6
  if (Array.isArray(value)) return value.map((v) => normalize(v, dropKeys))
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !dropKeys.includes(key))
        .map(([key, v]) => [key, normalize(v, dropKeys)])
    )
  }
  return value
}
