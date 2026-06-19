export type AuditEntityType =
  | 'producto'
  | 'venta'
  | 'movimiento_inventario'
  | 'sesion_caja'
  | 'movimiento_caja'

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

export interface AuditLog {
  id: string
  tiendaId: string
  userId: string
  userEmail: string
  entityType: AuditEntityType
  entityId: string
  entityLabel: string | null
  action: AuditAction
  changes: Record<string, unknown> | null
  createdAt: Date
}

export interface AuditLogFilter {
  entityType?: AuditEntityType
  from?: Date
  to?: Date
  limit?: number
}
