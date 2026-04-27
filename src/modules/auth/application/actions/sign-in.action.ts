'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/infrastructure/supabase/server'
import { loginFormSchema } from '../../forms/login-form.factory'
import { loginFormMapper } from '../../forms/login-form.mapper'
import type { Role } from '@/shared/types'

export type SignInActionState = {
  error: string | null
}

export async function signInAction(
  _prev: SignInActionState,
  formData: FormData,
): Promise<SignInActionState> {
  // 1. Validar input
  const raw = {
    email:    formData.get('email'),
    password: formData.get('password'),
  }

  const parsed = loginFormSchema.safeParse(raw)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]?.message ?? 'Datos inválidos'
    return { error: firstError }
  }

  const credentials = loginFormMapper.toSignInPayload(parsed.data)
  const supabase = await createClient()

  // 2. Autenticar con Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword(credentials)

  if (authError || !authData.user) {
    return { error: 'Correo o contraseña incorrectos' }
  }

  // 3. Verificar que el usuario tiene acceso a al menos una tienda activa
  type UserTiendaRow = { tienda_id: string; rol: string; is_active: boolean }

  const { data: userTiendas, error: tiendaError } = await supabase
    .from('user_tiendas')
    .select('tienda_id, rol, is_active')
    .eq('user_id', authData.user.id)
    .eq('is_active', true)
    .limit(1)
    .returns<UserTiendaRow[]>()

  if (tiendaError || !userTiendas || userTiendas.length === 0) {
    // Cerrar sesión si no tiene acceso
    await supabase.auth.signOut()
    return { error: 'Tu usuario no tiene acceso a ninguna tienda. Contacta al administrador.' }
  }

  // 4. Redirigir según rol
  const role = userTiendas[0].rol as Role
  const destination = role === 'admin' ? '/productos' : '/pos'

  redirect(destination)
}
