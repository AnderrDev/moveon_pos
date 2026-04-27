import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from './database.types'

// Omitimos __InternalSupabase para que el cliente resuelva correctamente
// el schema 'public' y sus tipos de tabla (Insert, Update, Row).
type AppDatabase = Omit<Database, '__InternalSupabase'>

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<AppDatabase>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}

export type { AppDatabase }
