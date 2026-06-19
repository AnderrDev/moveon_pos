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

/**
 * Decide si un rol puede corregir el método de pago de una venta. Solo `admin`.
 */
export function canCorrectPayment(rol: Role | null): boolean {
  return rol === 'admin'
}

/**
 * Decide si un rol puede anular un movimiento de caja (entrada/salida/gasto).
 * Solo `admin` — la caja es compartida (ADR 0007) pero anular requiere el
 * mismo nivel de confianza que anular una venta: cualquier cajero puede
 * registrar movimientos, pero no puede borrar su propio rastro.
 */
export function canVoidCashMovement(rol: Role | null): boolean {
  return rol === 'admin'
}
