import type { AuditAction, AuditEntityType, AuditLog } from '@angular-app/features/audit/domain/entities/audit-log.entity'

export interface AuditLogRow {
  id: string
  tienda_id: string
  user_id: string
  user_email: string
  entity_type: string
  entity_id: string
  entity_label: string | null
  action: string
  changes: Record<string, unknown> | null
  created_at: string
}

export function rowToAuditLog(row: AuditLogRow): AuditLog {
  return {
    id: row.id,
    tiendaId: row.tienda_id,
    userId: row.user_id,
    userEmail: row.user_email,
    entityType: row.entity_type as AuditEntityType,
    entityId: row.entity_id,
    entityLabel: row.entity_label,
    action: row.action as AuditAction,
    changes: row.changes,
    createdAt: new Date(row.created_at),
  }
}
