'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getAuthContext } from '@/shared/lib/auth-context'
import { SupabaseClienteRepository } from '../../infrastructure/repositories/supabase-cliente.repository'

export type ClienteActionState = { error: string | null }
const OK: ClienteActionState = { error: null }

const clienteSchema = z.object({
  nombre:          z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres').max(120),
  tipoDocumento:   z.string().trim().optional().or(z.literal('')),
  numeroDocumento: z.string().trim().optional().or(z.literal('')),
  email:           z.string().trim().email('Correo inválido').optional().or(z.literal('')),
  telefono:        z.string().trim().max(20).optional().or(z.literal('')),
})

export async function createClienteAction(
  _prev: ClienteActionState,
  formData: FormData,
): Promise<ClienteActionState> {
  const auth = await getAuthContext()
  if (!auth) return { error: 'No autenticado' }

  const parsed = clienteSchema.safeParse({
    nombre:          formData.get('nombre'),
    tipoDocumento:   formData.get('tipoDocumento'),
    numeroDocumento: formData.get('numeroDocumento'),
    email:           formData.get('email'),
    telefono:        formData.get('telefono'),
  })
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Datos inválidos' }

  const repo   = new SupabaseClienteRepository()
  const result = await repo.create({
    tiendaId:        auth.tiendaId,
    nombre:          parsed.data.nombre,
    tipoDocumento:   parsed.data.tipoDocumento || undefined,
    numeroDocumento: parsed.data.numeroDocumento || undefined,
    email:           parsed.data.email || undefined,
    telefono:        parsed.data.telefono || undefined,
  })

  if (!result.ok) {
    if (result.error.message.includes('ux_clientes_documento')) {
      return { error: 'Ya existe un cliente con ese documento' }
    }
    return { error: 'No se pudo crear el cliente' }
  }

  revalidatePath('/clientes')
  return OK
}

export async function updateClienteAction(
  id: string,
  _prev: ClienteActionState,
  formData: FormData,
): Promise<ClienteActionState> {
  const auth = await getAuthContext()
  if (!auth) return { error: 'No autenticado' }

  const parsed = clienteSchema.safeParse({
    nombre:          formData.get('nombre'),
    tipoDocumento:   formData.get('tipoDocumento'),
    numeroDocumento: formData.get('numeroDocumento'),
    email:           formData.get('email'),
    telefono:        formData.get('telefono'),
  })
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Datos inválidos' }

  const repo   = new SupabaseClienteRepository()
  const result = await repo.update(id, auth.tiendaId, {
    nombre:          parsed.data.nombre,
    tipoDocumento:   parsed.data.tipoDocumento || undefined,
    numeroDocumento: parsed.data.numeroDocumento || undefined,
    email:           parsed.data.email || undefined,
    telefono:        parsed.data.telefono || undefined,
  })

  if (!result.ok) {
    if (result.error.message.includes('ux_clientes_documento')) {
      return { error: 'Ya existe un cliente con ese documento' }
    }
    return { error: 'No se pudo actualizar el cliente' }
  }

  revalidatePath('/clientes')
  return OK
}

export async function deleteClienteAction(id: string): Promise<ClienteActionState> {
  const auth = await getAuthContext()
  if (!auth) return { error: 'No autenticado' }

  const repo   = new SupabaseClienteRepository()
  const result = await repo.delete(id, auth.tiendaId)

  if (!result.ok) return { error: 'No se pudo eliminar el cliente' }

  revalidatePath('/clientes')
  return OK
}
