import type { AuditLog } from '@angular-app/features/audit/domain/entities/audit-log.entity'

export interface AuditLogRow {
  id: string
  tienda_id: string
  user_id: string | null
  user_email: string | null
  entity_type: string | null
  entity_id: string | null
  entity_label: string | null
  action: string
  changes: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export function rowToAuditLog(row: AuditLogRow): AuditLog {
  const details =
    row.metadata || row.changes ? { ...(row.metadata ?? {}), ...(row.changes ?? {}) } : null
  return {
    id: row.id,
    tiendaId: row.tienda_id,
    userId: row.user_id,
    userEmail: row.user_email ?? '',
    entityType: row.entity_type,
    entityId: row.entity_id,
    entityLabel: row.entity_label,
    action: row.action,
    details,
    createdAt: new Date(row.created_at),
  }
}
