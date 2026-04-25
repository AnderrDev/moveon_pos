import 'server-only'
import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

/**
 * Cliente con service role — bypassa RLS.
 * SOLO usar en Server Actions o Edge Functions con validación de permisos manual.
 */
export function createServiceRoleClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
