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

/**
 * Decide si un rol puede corregir el monto de apertura de la sesión de caja
 * abierta. NO es admin-only: la caja es compartida (ADR 0007 / PLAN-19) y la
 * corrección de apertura solo modifica `opening_amount` (queda auditada con
 * valor anterior/nuevo), nunca borra rastro como sí lo hace anular un
 * movimiento. Restringirlo a admin reintroduciría la fricción que causó el
 * workaround manual del incidente 2026-06-22.
 */
export function canCorrectCashSessionOpening(rol: Role | null): boolean {
  if (rol === null) return false
  return rol === 'admin' || rol === 'cajero'
}

/**
 * Decide si un rol puede ver el historial de turnos de caja ya cerrados
 * (movimientos y ventas de sesiones pasadas). Solo `admin` — es información
 * de supervisión sobre el trabajo de todos los cajeros, no una operación que
 * el cajero necesite para su propio turno (que ya ve en `/caja` mientras
 * está abierto).
 */
export function canViewClosedSessions(rol: Role | null): boolean {
  return rol === 'admin'
}
