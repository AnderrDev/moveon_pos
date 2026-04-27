'use server'

import { revalidatePath } from 'next/cache'
import { getAuthContext } from '@/shared/lib/auth-context'
import { SupabaseInventoryRepository } from '../../infrastructure/repositories/supabase-inventory.repository'
import { registerEntrySchema, adjustStockSchema } from '../dtos/inventory.dto'

export type InventoryActionState = { error: string | null }
const OK: InventoryActionState = { error: null }

// ── Registrar entrada de mercancía ─────────────────────────────────────────────

export async function registerEntryAction(
  _prev: InventoryActionState,
  formData: FormData,
): Promise<InventoryActionState> {
  const auth = await getAuthContext()
  if (!auth) return { error: 'No autenticado' }

  const parsed = registerEntrySchema.safeParse({
    productId:     formData.get('productId'),
    cantidad:      Number(formData.get('cantidad')),
    costoUnitario: formData.get('costoUnitario') ? Number(formData.get('costoUnitario')) : undefined,
    motivo:        (formData.get('motivo') as string) || undefined,
  })
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Datos inválidos' }

  const repo = new SupabaseInventoryRepository()
  const result = await repo.registerEntry({
    tiendaId:      auth.tiendaId,
    productId:     parsed.data.productId,
    cantidad:      parsed.data.cantidad,
    costoUnitario: parsed.data.costoUnitario,
    motivo:        parsed.data.motivo,
    createdBy:     auth.userId,
  })

  if (!result.ok) return { error: result.error.message }

  revalidatePath('/inventario')
  return OK
}

// ── Ajuste manual de stock ─────────────────────────────────────────────────────

export async function adjustStockAction(
  _prev: InventoryActionState,
  formData: FormData,
): Promise<InventoryActionState> {
  const auth = await getAuthContext()
  if (!auth) return { error: 'No autenticado' }

  const parsed = adjustStockSchema.safeParse({
    productId:     formData.get('productId'),
    cantidadDelta: Number(formData.get('cantidadDelta')),
    motivo:        formData.get('motivo'),
  })
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Datos inválidos' }

  const repo = new SupabaseInventoryRepository()
  const result = await repo.adjustStock({
    tiendaId:      auth.tiendaId,
    productId:     parsed.data.productId,
    cantidadDelta: parsed.data.cantidadDelta,
    motivo:        parsed.data.motivo,
    createdBy:     auth.userId,
  })

  if (!result.ok) return { error: result.error.message }

  revalidatePath('/inventario')
  return OK
}
