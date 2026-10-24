import type { AuditModule } from '@angular-app/features/audit/domain/services/audit-modules'

export type AuditEntityType =
  | 'producto'
  | 'venta'
  | 'movimiento_inventario'
  | 'sesion_caja'
  | 'movimiento_caja'
  | 'cliente'

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'activate'
  | 'deactivate'
  | 'void'
  | 'open'
  | 'close'
  | 'entry'
  | 'adjust'
  | 'transfer'
  | 'correct_payment'
  | 'correct_opening'
  | 'correct_movement'

/**
 * Registro leído. `entityType` y `action` son texto libre porque conviven
 * los valores de la app (`AuditEntityType`/`AuditAction`) y los de las
 * funciones de la base (`sale`, `sale.voided`, ...).
 */
export interface AuditLog {
  id: string
  tiendaId: string
  userId: string | null
  userEmail: string
  entityType: string | null
  entityId: string | null
  entityLabel: string | null
  action: string
  /** `metadata` (registros de la base) y `changes` (de la app) unidos. */
  details: Record<string, unknown> | null
  createdAt: Date
}

export interface AuditLogFilter {
  module?: AuditModule
  from?: Date
  to?: Date
  limit?: number
}
