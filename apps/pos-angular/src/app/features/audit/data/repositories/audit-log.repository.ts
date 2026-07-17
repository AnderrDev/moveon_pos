import { inject, Injectable } from '@angular/core'
import { SupabaseClientService } from '@angular-app/core/supabase/supabase-client.service'
import { SessionService } from '@angular-app/core/auth/session.service'
import type { AuditLog, AuditLogFilter } from '@angular-app/features/audit/domain/entities/audit-log.entity'
import {
  AuditLogRepository as AuditLogRepositoryContract,
  type LogEventInput,
} from '@angular-app/features/audit/domain/repositories/audit-log.repository'
import { rowToAuditLog, type AuditLogRow } from '@angular-app/features/audit/data/models/audit-log.mapper'

@Injectable({ providedIn: 'root' })
export class AuditLogRepository extends AuditLogRepositoryContract {
  private readonly supabase = inject(SupabaseClientService)
  private readonly session = inject(SessionService)

  /** Fire-and-forget: llama sin await. Nunca lanza. */
  async log(event: LogEventInput): Promise<void> {
    try {
      const auth = await this.session.getAuthContext()
      if (!auth) return
      const db = this.supabase.supabase as unknown as {
        from(t: string): { insert(v: Record<string, unknown>): Promise<{ error: unknown }> }
      }
      await db.from('audit_logs').insert({
        tienda_id: event.tiendaId,
        user_id: auth.userId,
        user_email: auth.email ?? '',
        entity_type: event.entityType,
        entity_id: event.entityId,
        entity_label: event.entityLabel ?? null,
        action: event.action,
        changes: event.changes ?? null,
      })
    } catch {
      // La auditoría nunca debe romper el flujo principal
    }
  }

  async list(tiendaId: string, filter: AuditLogFilter = {}): Promise<AuditLog[]> {
    let query = this.supabase.supabase
      .from('audit_logs')
      .select('id, tienda_id, user_id, user_email, entity_type, entity_id, entity_label, action, changes, created_at')
      .eq('tienda_id', tiendaId)
      .order('created_at', { ascending: false })
      .limit(filter.limit ?? 200)

    if (filter.entityType) query = query.eq('entity_type', filter.entityType)
    if (filter.from) query = query.gte('created_at', filter.from.toISOString())
    if (filter.to) query = query.lt('created_at', filter.to.toISOString())

    const { data, error } = await query.returns<AuditLogRow[]>()
    if (error) throw new Error(error.message)
    return (data ?? []).map(rowToAuditLog)
  }
}
