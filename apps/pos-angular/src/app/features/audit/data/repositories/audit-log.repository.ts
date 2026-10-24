import { AUDIT_MODULES } from '@angular-app/features/audit/domain/services/audit-modules'
import { inject, Injectable } from '@angular/core'
import { SupabaseClientService } from '@angular-app/core/supabase/supabase-client.service'
import { SessionService } from '@angular-app/core/auth/session.service'
import type { AuditLog, AuditLogFilter } from '@angular-app/features/audit/domain/entities/audit-log.entity'
import {
  AuditLogRepository as AuditLogRepositoryContract,
  type LogEventInput,
} from '@angular-app/features/audit/domain/repositories/audit-log.repository'
import { rowToAuditLog, type AuditLogRow } from '@angular-app/features/audit/data/models/audit-log.mapper'
import type { Json } from '@/infrastructure/supabase/database.types'

@Injectable({ providedIn: 'root' })
export class AuditLogRepository extends AuditLogRepositoryContract {
  private readonly supabase = inject(SupabaseClientService)
  private readonly session = inject(SessionService)

  /** Fire-and-forget: llama sin await. Nunca lanza. */
  async log(event: LogEventInput): Promise<void> {
    try {
      const auth = await this.session.getAuthContext()
      if (!auth) return
      await this.supabase.supabase.from('audit_logs').insert({
        tienda_id: event.tiendaId,
        user_id: auth.userId,
        user_email: auth.email ?? '',
        entity_type: event.entityType,
        entity_id: event.entityId,
        entity_label: event.entityLabel ?? null,
        action: event.action,
        // `changes` es Record<string, unknown> en el dominio; se guarda como jsonb.
        changes: (event.changes ?? null) as Json,
      })
    } catch {
      // La auditoría nunca debe romper el flujo principal
    }
  }

  async list(tiendaId: string, filter: AuditLogFilter = {}): Promise<AuditLog[]> {
    let query = this.supabase.supabase
      .from('audit_logs')
      .select('id, tienda_id, user_id, user_email, entity_type, entity_id, entity_label, action, changes, metadata, created_at')
      .eq('tienda_id', tiendaId)
      .order('created_at', { ascending: false })
      .limit(filter.limit ?? 200)

    if (filter.module) {
      const module = AUDIT_MODULES.find((m) => m.key === filter.module)
      if (module) {
        // Las dos convenciones: tipo de entidad de la app o prefijo de acción de la base.
        const conditions = [
          `entity_type.in.(${module.entityTypes.join(',')})`,
          ...module.actionPrefixes.map((p) => `action.like.${p}*`),
        ]
        query = query.or(conditions.join(','))
      }
    }
    if (filter.from) query = query.gte('created_at', filter.from.toISOString())
    if (filter.to) query = query.lt('created_at', filter.to.toISOString())

    const { data, error } = await query.returns<AuditLogRow[]>()
    if (error) throw new Error(error.message)
    return (data ?? []).map(rowToAuditLog)
  }
}
