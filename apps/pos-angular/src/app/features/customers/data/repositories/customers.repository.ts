import { inject, Injectable } from '@angular/core'
import { SupabaseClientService } from '@angular-app/core/supabase/supabase-client.service'
import { fetchAllPages } from '@angular-app/core/supabase/fetch-all-pages'
import { AuditLogRepository } from '@angular-app/features/audit/domain/repositories/audit-log.repository'
import { normalizePhoneCO } from '@angular-app/features/customers/domain/value-objects/phone-co'
import type { Cliente } from '@angular-app/features/customers/domain/entities/cliente.entity'
import {
  CustomerRepository as CustomerRepositoryContract,
  type ClienteInput,
} from '@angular-app/features/customers/domain/repositories/customer.repository'
import {
  CLIENTE_COLS,
  mapWriteError,
  rowToCliente,
  toWriteValues,
  type ClienteRow,
} from '@angular-app/features/customers/data/models/customer.mapper'

interface UntypedClient {
  from(table: string): {
    insert(values: Record<string, unknown>): {
      select(cols: string): {
        single<T>(): Promise<{ data: T | null; error: { message: string } | null }>
      }
    }
    update(values: Record<string, unknown>): {
      eq(col: string, value: unknown): {
        eq(col: string, value: unknown): {
          select(cols: string): {
            single<T>(): Promise<{ data: T | null; error: { message: string } | null }>
          }
        }
      }
    }
    delete(): {
      eq(col: string, value: unknown): {
        eq(col: string, value: unknown): Promise<{ error: { message: string } | null }>
      }
    }
  }
}

@Injectable({ providedIn: 'root' })
export class CustomersRepository extends CustomerRepositoryContract {
  private readonly supabaseClient = inject(SupabaseClientService)
  private readonly audit = inject(AuditLogRepository)

  async list(tiendaId: string): Promise<Cliente[]> {
    const rows = await fetchAllPages<ClienteRow>(async (from, to) => {
      const { data, error } = await this.supabaseClient.supabase
        .from('clientes')
        .select(CLIENTE_COLS)
        .eq('tienda_id', tiendaId)
        .order('nombre', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to)
        .returns<ClienteRow[]>()
      if (error) throw new Error(error.message)
      return data ?? []
    })
    return rows.map(rowToCliente)
  }

  /**
   * Búsqueda flexible por celular normalizado O por número de documento.
   * Devuelve el primer match exacto (celular gana sobre documento).
   */
  async findByPhoneOrDocument(tiendaId: string, query: string): Promise<Cliente | null> {
    const normalized = normalizePhoneCO(query)
    const document = query.replace(/\D/g, '')

    if (normalized) {
      const byPhone = await this.findOne(tiendaId, 'celular_normalizado', normalized)
      if (byPhone) return byPhone
    }
    if (document.length >= 5) {
      return this.findOne(tiendaId, 'numero_documento', document)
    }
    return null
  }

  private async findOne(tiendaId: string, column: string, value: string): Promise<Cliente | null> {
    const { data, error } = await this.supabaseClient.supabase
      .from('clientes')
      .select(CLIENTE_COLS)
      .eq('tienda_id', tiendaId)
      .eq(column, value)
      .limit(1)
      .returns<ClienteRow[]>()
    if (error) throw new Error(error.message)
    return data?.[0] ? rowToCliente(data[0]) : null
  }

  async create(tiendaId: string, input: ClienteInput): Promise<Cliente> {
    const client = this.supabaseClient.supabase as unknown as UntypedClient
    const { data, error } = await client
      .from('clientes')
      .insert({ tienda_id: tiendaId, ...toWriteValues(input) })
      .select(CLIENTE_COLS)
      .single<ClienteRow>()
    if (error) throw mapWriteError(error.message)
    if (!data) throw new Error('Cliente creado sin respuesta')
    const cliente = rowToCliente(data)
    void this.audit.log({
      tiendaId,
      entityType: 'cliente',
      entityId: cliente.id,
      entityLabel: cliente.nombre,
      action: 'create',
      changes: { tipoDocumento: cliente.tipoDocumento, numeroDocumento: cliente.numeroDocumento },
    })
    return cliente
  }

  async update(id: string, tiendaId: string, input: ClienteInput): Promise<Cliente> {
    const client = this.supabaseClient.supabase as unknown as UntypedClient
    const { data, error } = await client
      .from('clientes')
      .update(toWriteValues(input))
      .eq('id', id)
      .eq('tienda_id', tiendaId)
      .select(CLIENTE_COLS)
      .single<ClienteRow>()
    if (error) throw mapWriteError(error.message)
    if (!data) throw new Error('Cliente actualizado sin respuesta')
    const cliente = rowToCliente(data)
    const auditChanges: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(input)) if (v !== undefined) auditChanges[k] = v
    void this.audit.log({
      tiendaId,
      entityType: 'cliente',
      entityId: id,
      entityLabel: cliente.nombre,
      action: 'update',
      changes: auditChanges,
    })
    return cliente
  }

  async delete(id: string, tiendaId: string): Promise<void> {
    const { data } = await this.supabaseClient.supabase
      .from('clientes')
      .select(CLIENTE_COLS)
      .eq('id', id)
      .eq('tienda_id', tiendaId)
      .maybeSingle<ClienteRow>()
    const label = data ? rowToCliente(data).nombre : id

    const client = this.supabaseClient.supabase as unknown as UntypedClient
    const { error } = await client.from('clientes').delete().eq('id', id).eq('tienda_id', tiendaId)
    if (error) throw new Error(error.message)
    void this.audit.log({ tiendaId, entityType: 'cliente', entityId: id, entityLabel: label, action: 'delete' })
  }
}
