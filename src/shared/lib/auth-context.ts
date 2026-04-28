import { cache } from 'react'
import { createClient } from '@/infrastructure/supabase/server'
import type { Role } from '@/shared/types'

export interface AuthContext {
  userId: string
  tiendaId: string
  rol: Role
  email: string | null
}

// cache() deduplicates within a single RSC render tree (layout + page share one result)
export const getAuthContext = cache(async (): Promise<AuthContext | null> => {
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
    email:    user.email ?? null,
  }
})
