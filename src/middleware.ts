import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { AppDatabase } from '@/infrastructure/supabase/server'

// Rutas que requieren autenticación
const PROTECTED_PREFIXES = ['/pos', '/productos', '/inventario', '/caja', '/clientes', '/reportes']

// Rutas de autenticación (redirigen a /pos si ya hay sesión)
const AUTH_PATHS = ['/login']

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient<AppDatabase>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // Refrescar sesión (importante para que los tokens no expiren silenciosamente)
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  const isAuthPath  = AUTH_PATHS.includes(pathname)

  // Sin sesión intentando acceder a ruta protegida → login
  if (!user && isProtected) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Con sesión intentando acceder a login → /pos
  if (user && isAuthPath) {
    return NextResponse.redirect(new URL('/pos', request.url))
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Excluir: archivos estáticos, _next, API routes internas.
     * Incluir: todas las rutas de página.
     */
    '/((?!_next/static|_next/image|favicon.ico|api/).*)',
  ],
}
