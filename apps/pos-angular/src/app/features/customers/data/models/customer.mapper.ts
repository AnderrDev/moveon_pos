import { normalizePhoneCO } from '@angular-app/features/customers/domain/value-objects/phone-co'
import type { Cliente } from '@angular-app/features/customers/domain/entities/cliente.entity'
import type { ClienteInput } from '@angular-app/features/customers/domain/repositories/customer.repository'

export interface ClienteRow {
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

export const CLIENTE_COLS =
  'id, tienda_id, tipo_documento, numero_documento, nombre, email, telefono, celular_normalizado, activo, autoriza_fidelizacion, acepta_mensajes_promocionales, created_at, updated_at'

export function rowToCliente(row: ClienteRow): Cliente {
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

/**
 * Payload de escritura: `celular_normalizado` se deriva SIEMPRE del teléfono con
 * el value object del dominio (RN-CL05); si el teléfono no es un celular
 * colombiano válido queda null (el cliente existe, pero no es localizable por
 * celular para fidelización).
 */
export function toWriteValues(input: ClienteInput): Record<string, unknown> {
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

export function mapWriteError(message: string): Error {
  if (message.includes('ux_clientes_celular_normalizado')) {
    return new Error('Ya existe un cliente con ese número de celular')
  }
  if (message.includes('ux_clientes_documento')) {
    return new Error('Ya existe un cliente con ese documento')
  }
  return new Error(message)
}
