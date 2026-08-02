import type { AuditAction, AuditEntityType, AuditLog, AuditLogFilter } from '@angular-app/features/audit/domain/entities/audit-log.entity'

export interface LogEventInput {
  tiendaId: string
  entityType: AuditEntityType
  entityId: string
  entityLabel?: string | null
  action: AuditAction
  changes?: Record<string, unknown> | null
}

/**
 * Contrato de persistencia de auditoría. Abstract class (ADR 0015 §6.1).
 * No existía interfaz previa — creado desde el uso real de
 * `AuditLogRepository` (2026-07-17). Se consume desde casi todos los demás
 * repositorios (cash-register, inventory, products, sales); esos siguen
 * inyectando la clase concreta hasta que se cableen en PLAN-67 — este
 * contrato solo habilita la infraestructura de DI, no fuerza el cambio aún.
 */
export abstract class AuditLogRepository {
  /** Fire-and-forget: se llama sin await. Nunca lanza. */
  abstract log(event: LogEventInput): Promise<void>
  abstract list(tiendaId: string, filter?: AuditLogFilter): Promise<AuditLog[]>
}
