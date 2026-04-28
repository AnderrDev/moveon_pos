'use server'

import { getAuthContext } from '@/shared/lib/auth-context'
import { SupabaseClienteRepository } from '../../infrastructure/repositories/supabase-cliente.repository'

export type ClienteOption = { id: string; nombre: string; documento: string | null }

export async function listClientesAction(): Promise<ClienteOption[]> {
  const auth = await getAuthContext()
  if (!auth) return []

  const repo   = new SupabaseClienteRepository()
  const result = await repo.list(auth.tiendaId)
  if (!result.ok) return []

  return result.value.map((c) => ({
    id:         c.id,
    nombre:     c.nombre,
    documento:  c.numeroDocumento
      ? `${c.tipoDocumento ?? ''} ${c.numeroDocumento}`.trim()
      : null,
  }))
}
