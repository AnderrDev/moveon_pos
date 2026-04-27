import { createClient } from '@/infrastructure/supabase/server'
import { ok, err } from '@/shared/result'
import type { Result } from '@/shared/result'
import type { TiendaId } from '@/shared/types'
import type { Cliente } from '../../domain/entities/cliente.entity'

/* eslint-disable @typescript-eslint/no-explicit-any */

type ClienteRow = {
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

function rowToCliente(row: ClienteRow): Cliente {
  return {
    id:               row.id,
    tiendaId:         row.tienda_id,
    tipoDocumento:    row.tipo_documento,
    numeroDocumento:  row.numero_documento,
    nombre:           row.nombre,
    email:            row.email,
    telefono:         row.telefono,
    createdAt:        new Date(row.created_at),
    updatedAt:        new Date(row.updated_at),
  }
}

const COLS = 'id, tienda_id, tipo_documento, numero_documento, nombre, email, telefono, created_at, updated_at'

export class SupabaseClienteRepository {
  async list(tiendaId: TiendaId): Promise<Result<Cliente[]>> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('clientes')
      .select(COLS)
      .eq('tienda_id', tiendaId)
      .order('nombre', { ascending: true })
      .returns<ClienteRow[]>()

    if (error) return err(new Error(error.message))
    return ok((data ?? []).map(rowToCliente))
  }

  async create(input: {
    tiendaId: TiendaId
    nombre: string
    tipoDocumento?: string
    numeroDocumento?: string
    email?: string
    telefono?: string
  }): Promise<Result<Cliente>> {
    const supabase = await createClient()
    const { data, error } = await (supabase as any)
      .from('clientes')
      .insert({
        tienda_id:        input.tiendaId,
        nombre:           input.nombre,
        tipo_documento:   input.tipoDocumento ?? null,
        numero_documento: input.numeroDocumento ?? null,
        email:            input.email ?? null,
        telefono:         input.telefono ?? null,
      })
      .select(COLS)
      .single()

    if (error) return err(new Error(error.message))
    return ok(rowToCliente(data as ClienteRow))
  }

  async update(id: string, tiendaId: TiendaId, input: {
    nombre: string
    tipoDocumento?: string
    numeroDocumento?: string
    email?: string
    telefono?: string
  }): Promise<Result<Cliente>> {
    const supabase = await createClient()
    const { data, error } = await (supabase as any)
      .from('clientes')
      .update({
        nombre:           input.nombre,
        tipo_documento:   input.tipoDocumento ?? null,
        numero_documento: input.numeroDocumento ?? null,
        email:            input.email ?? null,
        telefono:         input.telefono ?? null,
      })
      .eq('id', id)
      .eq('tienda_id', tiendaId)
      .select(COLS)
      .single()

    if (error) return err(new Error(error.message))
    return ok(rowToCliente(data as ClienteRow))
  }

  async delete(id: string, tiendaId: TiendaId): Promise<Result<void>> {
    const supabase = await createClient()
    const { error } = await (supabase as any)
      .from('clientes')
      .delete()
      .eq('id', id)
      .eq('tienda_id', tiendaId)

    if (error) return err(new Error(error.message))
    return ok(undefined)
  }
}
