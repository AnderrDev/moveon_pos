import { inject, Injectable } from '@angular/core'
import { SupabaseClientService } from '@angular-app/core/supabase/supabase-client.service'
import { normalizePhoneCO } from '@angular-app/features/customers/domain/value-objects/phone-co'
import type { Cliente } from '@angular-app/features/customers/domain/entities/cliente.entity'

interface ClienteRow {
  id: string
  tienda_id: string
  tipo_documento: string | null
  numero_documento: string | null
  nombre: string
  email: string | null
  telefono: string | null
  celular_normalizado: string | null
  activo: boolean
  autoriza_fidelizacion: boolean
  acepta_mensajes_promocionales: boolean
  created_at: string
  updated_at: string
}

const COLS =
  'id, tienda_id, tipo_documento, numero_documento, nombre, email, telefono, celular_normalizado, activo, autoriza_fidelizacion, acepta_mensajes_promocionales, created_at, updated_at'

function rowToCliente(row: ClienteRow): Cliente {
  return {
    id: row.id,
    tiendaId: row.tienda_id,
    tipoDocumento: row.tipo_documento,
    numeroDocumento: row.numero_documento,
    nombre: row.nombre,
    email: row.email,
    telefono: row.telefono,
    celularNormalizado: row.celular_normalizado,
    activo: row.activo,
    autorizaFidelizacion: row.autoriza_fidelizacion,
    aceptaMensajesPromocionales: row.acepta_mensajes_promocionales,
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
  autorizaFidelizacion?: boolean
  aceptaMensajesPromocionales?: boolean
}

/**
 * Payload de escritura: `celular_normalizado` se deriva SIEMPRE del teléfono con
 * el value object del dominio (RN-CL05); si el teléfono no es un celular
 * colombiano válido queda null (el cliente existe, pero no es localizable por
 * celular para fidelización).
 */
function toWriteValues(input: ClienteInput): Record<string, unknown> {
  const telefono = input.telefono?.trim() || null
  return {
    nombre: input.nombre,
    tipo_documento: input.tipoDocumento ?? null,
    numero_documento: input.numeroDocumento ?? null,
    email: input.email ?? null,
    telefono,
    celular_normalizado: telefono ? normalizePhoneCO(telefono) : null,
    autoriza_fidelizacion: input.autorizaFidelizacion ?? false,
    acepta_mensajes_promocionales: input.aceptaMensajesPromocionales ?? false,
  }
}

function mapWriteError(message: string): Error {
  if (message.includes('ux_clientes_celular_normalizado')) {
    return new Error('Ya existe un cliente con ese número de celular')
  }
  if (message.includes('ux_clientes_documento')) {
    return new Error('Ya existe un cliente con ese documento')
  }
  return new Error(message)
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
      .select(COLS)
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
      .select(COLS)
      .single<ClienteRow>()
    if (error) throw mapWriteError(error.message)
    if (!data) throw new Error('Cliente creado sin respuesta')
    return rowToCliente(data)
  }

  async update(id: string, tiendaId: string, input: ClienteInput): Promise<Cliente> {
    const client = this.supabaseClient.supabase as unknown as UntypedClient
    const { data, error } = await client
      .from('clientes')
      .update(toWriteValues(input))
      .eq('id', id)
      .eq('tienda_id', tiendaId)
      .select(COLS)
      .single<ClienteRow>()
    if (error) throw mapWriteError(error.message)
    if (!data) throw new Error('Cliente actualizado sin respuesta')
    return rowToCliente(data)
  }

  async delete(id: string, tiendaId: string): Promise<void> {
    const client = this.supabaseClient.supabase as unknown as UntypedClient
    const { error } = await client.from('clientes').delete().eq('id', id).eq('tienda_id', tiendaId)
    if (error) throw new Error(error.message)
  }
}
