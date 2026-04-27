import { createClient } from '@/infrastructure/supabase/server'
import type { Role } from '@/shared/types'

export interface AuthContext {
  userId: string
  tiendaId: string
  rol: Role
}

/**
 * Obtiene el contexto de autenticación para usar en Server Actions.
 * Devuelve null si el usuario no está autenticado o no tiene tienda activa.
 */
export async function getAuthContext(): Promise<AuthContext | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('user_tiendas')
    .select('tienda_id, rol')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .limit(1)
    .returns<Array<{ tienda_id: string; rol: string }>>()

  if (!data || data.length === 0) return null

  return {
    userId:   user.id,
    tiendaId: data[0].tienda_id,
    rol:      data[0].rol as Role,
  }
}
