// Pure authorization policy functions extracted from role.guard.ts and the POS
// so they can be unit-tested in a node environment without Angular TestBed/jsdom.
import type { Role } from '@/shared/types'

/**
 * Decide si un rol puede activar una ruta restringida a `allowed`.
 * Contexto sin rol (null) => no autorizado (nunca asumir admin).
 */
export function canActivateForRole(rol: Role | null, allowed: readonly Role[]): boolean {
  if (rol === null) return false
  return allowed.includes(rol)
}

/**
 * Decide si un rol puede anular ventas. Solo `admin`.
 */
export function canVoidSale(rol: Role | null): boolean {
  return rol === 'admin'
}
