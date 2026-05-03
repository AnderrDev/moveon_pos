import { inject, Injectable } from '@angular/core'
import { SupabaseClientService } from '../../core/supabase/supabase-client.service'
import type { Cliente } from '@/modules/customers/domain/entities/cliente.entity'

interface ClienteRow {
  id: string
  tienda_id: string
  tipo_documento: string | null
  numero_documento: string | null
  nombre: string
  email: string | null
  telefono: string | null
  created_at: string
  updated_at: string
}

const COLS =
  'id, tienda_id, tipo_documento, numero_documento, nombre, email, telefono, created_at, updated_at'

function rowToCliente(row: ClienteRow): Cliente {
  return {
    id: row.id,
    tiendaId: row.tienda_id,
    tipoDocumento: row.tipo_documento,
    numeroDocumento: row.numero_documento,
    nombre: row.nombre,
    email: row.email,
    telefono: row.telefono,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

export interface ClienteInput {
  nombre: string
  tipoDocumento?: string
  numeroDocumento?: string
  email?: string
  telefono?: string
}

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
export class CustomersRepository {
  private readonly supabaseClient = inject(SupabaseClientService)

  async list(tiendaId: string): Promise<Cliente[]> {
    const { data, error } = await this.supabaseClient.supabase
      .from('clientes')
      .select(COLS)
      .eq('tienda_id', tiendaId)
      .order('nombre', { ascending: true })
      .returns<ClienteRow[]>()
    if (error) throw new Error(error.message)
    return (data ?? []).map(rowToCliente)
  }

  async create(tiendaId: string, input: ClienteInput): Promise<Cliente> {
    const client = this.supabaseClient.supabase as unknown as UntypedClient
    const { data, error } = await client
      .from('clientes')
      .insert({
        tienda_id: tiendaId,
        nombre: input.nombre,
        tipo_documento: input.tipoDocumento ?? null,
        numero_documento: input.numeroDocumento ?? null,
        email: input.email ?? null,
        telefono: input.telefono ?? null,
      })
      .select(COLS)
      .single<ClienteRow>()
    if (error) throw new Error(error.message)
    if (!data) throw new Error('Cliente creado sin respuesta')
    return rowToCliente(data)
  }

  async update(id: string, tiendaId: string, input: ClienteInput): Promise<Cliente> {
    const client = this.supabaseClient.supabase as unknown as UntypedClient
    const { data, error } = await client
      .from('clientes')
      .update({
        nombre: input.nombre,
        tipo_documento: input.tipoDocumento ?? null,
        numero_documento: input.numeroDocumento ?? null,
        email: input.email ?? null,
        telefono: input.telefono ?? null,
      })
      .eq('id', id)
      .eq('tienda_id', tiendaId)
      .select(COLS)
      .single<ClienteRow>()
    if (error) throw new Error(error.message)
    if (!data) throw new Error('Cliente actualizado sin respuesta')
    return rowToCliente(data)
  }

  async delete(id: string, tiendaId: string): Promise<void> {
    const client = this.supabaseClient.supabase as unknown as UntypedClient
    const { error } = await client.from('clientes').delete().eq('id', id).eq('tienda_id', tiendaId)
    if (error) throw new Error(error.message)
  }
}
