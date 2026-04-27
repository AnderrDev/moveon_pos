'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/infrastructure/supabase/server'
import { getAuthContext } from '@/shared/lib/auth-context'
import { createCategoriaSchema, updateCategoriaSchema } from '../dtos/categoria.dto'

// Nota: @supabase/ssr v0.5 no resuelve correctamente los tipos Insert/Update
// a través de createServerClient. Los datos están validados con Zod antes de
// llegar aquí, y la seguridad se garantiza con RLS en Supabase.
/* eslint-disable @typescript-eslint/no-explicit-any */

export type ActionState = {
  status?: 'idle' | 'success' | 'error'
  message?: string
  error: string | null
}
const OK = (message: string): ActionState => ({ status: 'success', message, error: null })
const FAIL = (error: string): ActionState => ({ status: 'error', error })

// ── Crear ─────────────────────────────────────────────────────────────────────

export async function createCategoriaAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await getAuthContext()
  if (!auth) return FAIL('No autenticado')

  const parsed = createCategoriaSchema.safeParse({ nombre: formData.get('nombre') })
  if (!parsed.success) return FAIL(parsed.error.errors[0]?.message ?? 'Datos inválidos')

  const supabase = await createClient()
  const { error } = await (supabase as any)
    .from('categorias')
    .insert({ tienda_id: auth.tiendaId, nombre: parsed.data.nombre, orden: 0 })

  if (error) {
    if (error.code === '23505') return FAIL('Ya existe una categoría con ese nombre')
    return FAIL('No se pudo crear la categoría')
  }

  revalidatePath('/productos/categorias')
  return OK('Categoría creada correctamente')
}

// ── Actualizar ────────────────────────────────────────────────────────────────

export async function updateCategoriaAction(
  id: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await getAuthContext()
  if (!auth) return FAIL('No autenticado')

  const parsed = updateCategoriaSchema.safeParse({ nombre: formData.get('nombre') })
  if (!parsed.success) return FAIL(parsed.error.errors[0]?.message ?? 'Datos inválidos')

  const supabase = await createClient()
  const { error } = await (supabase as any)
    .from('categorias')
    .update({ nombre: parsed.data.nombre })
    .eq('id', id)
    .eq('tienda_id', auth.tiendaId)

  if (error) {
    if (error.code === '23505') return FAIL('Ya existe una categoría con ese nombre')
    return FAIL('No se pudo actualizar la categoría')
  }

  revalidatePath('/productos/categorias')
  return OK('Categoría actualizada correctamente')
}

// ── Desactivar ────────────────────────────────────────────────────────────────

export async function deactivateCategoriaAction(id: string): Promise<ActionState> {
  const auth = await getAuthContext()
  if (!auth) return FAIL('No autenticado')

  const supabase = await createClient()
  const { error } = await (supabase as any)
    .from('categorias')
    .update({ is_active: false })
    .eq('id', id)
    .eq('tienda_id', auth.tiendaId)

  if (error) return FAIL('No se pudo desactivar la categoría')

  revalidatePath('/productos/categorias')
  return OK('Categoría desactivada')
}

// ── Reactivar ─────────────────────────────────────────────────────────────────

export async function activateCategoriaAction(id: string): Promise<ActionState> {
  const auth = await getAuthContext()
  if (!auth) return FAIL('No autenticado')

  const supabase = await createClient()
  const { error } = await (supabase as any)
    .from('categorias')
    .update({ is_active: true })
    .eq('id', id)
    .eq('tienda_id', auth.tiendaId)

  if (error) return FAIL('No se pudo activar la categoría')

  revalidatePath('/productos/categorias')
  return OK('Categoría activada')
}
