/**
 * Fixtures de payload de la app iOS (ADR 0022 §4): lo que "MOVE ON Admin"
 * envía en cada escritura. Ver `fixtures/ios-payloads/README.md`.
 */
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

export const PAYLOADS_DIR = path.join(__dirname, '../fixtures/ios-payloads')

export interface IosPayload {
  description: string
  kind: 'rpc' | 'insert' | 'update'
  target: string
  /** Solo en `update`: columnas que identifican la fila. */
  match?: Record<string, string>
  payload: Record<string, unknown>
}

/** Nombres (sin `.json`) de todos los fixtures. */
export function payloadNames(): string[] {
  return readdirSync(PAYLOADS_DIR)
    .filter((file) => file.endsWith('.json'))
    .map((file) => file.replace(/\.json$/, ''))
    .sort()
}

/** Carga un fixture y reemplaza los marcadores `"{{nombre}}"`; falla si queda alguno sin valor. */
export function loadPayload(name: string, vars: Record<string, string>): IosPayload {
  const raw = readFileSync(path.join(PAYLOADS_DIR, `${name}.json`), 'utf8')
  const filled = raw.replace(/"\{\{(\w+)\}\}"/g, (_, key: string) => {
    if (!(key in vars)) throw new Error(`Falta el valor de {{${key}}} en ${name}.json`)
    return JSON.stringify(vars[key])
  })
  return JSON.parse(filled) as IosPayload
}
