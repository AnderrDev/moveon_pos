'use server'

import { revalidatePath } from 'next/cache'
import { getAuthContext } from '@/shared/lib/auth-context'
import { SupabaseInventoryRepository } from '../../infrastructure/repositories/supabase-inventory.repository'
import { registerEntrySchema, adjustStockSchema } from '../dtos/inventory.dto'

export type InventoryActionState = {
  status?: 'idle' | 'success' | 'error'
  message?: string
  error: string | null
}
const OK = (message: string): InventoryActionState => ({ status: 'success', message, error: null })
const FAIL = (error: string): InventoryActionState => ({ status: 'error', error })

// ── Registrar entrada de mercancía ─────────────────────────────────────────────

export async function registerEntryAction(
  _prev: InventoryActionState,
  formData: FormData,
): Promise<InventoryActionState> {
  const auth = await getAuthContext()
  if (!auth) return FAIL('No autenticado')

  const parsed = registerEntrySchema.safeParse({
    productId:     formData.get('productId'),
    cantidad:      Number(formData.get('cantidad')),
    costoUnitario: formData.get('costoUnitario') ? Number(formData.get('costoUnitario')) : undefined,
    motivo:        (formData.get('motivo') as string) || undefined,
  })
  if (!parsed.success) return FAIL(parsed.error.errors[0]?.message ?? 'Datos inválidos')

  const repo = new SupabaseInventoryRepository()
  const result = await repo.registerEntry({
    tiendaId:      auth.tiendaId,
    productId:     parsed.data.productId,
    cantidad:      parsed.data.cantidad,
    costoUnitario: parsed.data.costoUnitario,
    motivo:        parsed.data.motivo,
    createdBy:     auth.userId,
  })

  if (!result.ok) return FAIL(result.error.message)

  revalidatePath('/inventario')
  return OK('Entrada de mercancía registrada')
}

// ── Ajuste manual de stock ─────────────────────────────────────────────────────

export async function adjustStockAction(
  _prev: InventoryActionState,
  formData: FormData,
): Promise<InventoryActionState> {
  const auth = await getAuthContext()
  if (!auth) return FAIL('No autenticado')

  const parsed = adjustStockSchema.safeParse({
    productId:     formData.get('productId'),
    cantidadDelta: Number(formData.get('cantidadDelta')),
    motivo:        formData.get('motivo'),
  })
  if (!parsed.success) return FAIL(parsed.error.errors[0]?.message ?? 'Datos inválidos')

  const repo = new SupabaseInventoryRepository()
  const result = await repo.adjustStock({
    tiendaId:      auth.tiendaId,
    productId:     parsed.data.productId,
    cantidadDelta: parsed.data.cantidadDelta,
    motivo:        parsed.data.motivo,
    createdBy:     auth.userId,
  })

  if (!result.ok) return FAIL(result.error.message)

  revalidatePath('/inventario')
  return OK('Ajuste de stock guardado')
}
