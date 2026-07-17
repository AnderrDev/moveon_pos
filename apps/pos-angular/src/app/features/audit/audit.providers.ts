import type { Provider } from '@angular/core'
import { AuditLogRepository } from '@angular-app/features/audit/domain/repositories/audit-log.repository'
import { AuditLogRepository as SupabaseAuditLogRepository } from '@angular-app/features/audit/data/repositories/audit-log.repository'

/** Composition root de la feature (ADR 0015 §6.2). */
export const auditProviders: Provider[] = [
  { provide: AuditLogRepository, useClass: SupabaseAuditLogRepository },
]
