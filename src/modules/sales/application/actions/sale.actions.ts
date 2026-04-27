'use server'

import { revalidatePath } from 'next/cache'
import { getAuthContext } from '@/shared/lib/auth-context'
import { SupabaseSaleRepository } from '../../infrastructure/repositories/supabase-sale.repository'
import { SupabaseCashRegisterRepository } from '@/modules/cash-register/infrastructure/repositories/supabase-cash-register.repository'
import { SupabaseInventoryRepository } from '@/modules/inventory/infrastructure/repositories/supabase-inventory.repository'
import { createSaleSchema, voidSaleSchema } from '../dtos/sale.dto'
import type { CreateSaleDto } from '../dtos/sale.dto'

export type SaleActionState = {
  status?: 'idle' | 'success' | 'error'
  message?: string
  error: string | null
  saleId?: string
  saleNumber?: string
}
const OK = (saleId: string, saleNumber: string, message: string): SaleActionState => ({
  status: 'success',
  message,
  error: null,
  saleId,
  saleNumber,
})
const FAIL = (error: string): SaleActionState => ({ status: 'error', error })

// ── Crear venta ────────────────────────────────────────────────────────────────

export async function createSaleAction(dto: CreateSaleDto): Promise<SaleActionState> {
  const auth = await getAuthContext()
  if (!auth) return FAIL('No autenticado')

  const parsed = createSaleSchema.safeParse(dto)
  if (!parsed.success) return FAIL(parsed.error.errors[0]?.message ?? 'Datos inválidos')

  // Verificar sesión de caja abierta
  const cashRepo    = new SupabaseCashRegisterRepository()
  const sessionRes  = await cashRepo.getOpenSession(auth.tiendaId)
  if (!sessionRes.ok) return FAIL(sessionRes.error.message)
  if (!sessionRes.value) return FAIL('No hay caja abierta. Abre la caja antes de vender.')
  if (sessionRes.value.id !== parsed.data.cashSessionId) {
    return FAIL('La sesión de caja no coincide con la caja activa.')
  }

  // Verificar stock suficiente para cada ítem
  const invRepo = new SupabaseInventoryRepository()
  for (const item of parsed.data.items) {
    const stockRes = await invRepo.getStock(item.productId, auth.tiendaId)
    if (stockRes.ok && stockRes.value < item.quantity) {
      return FAIL(`Stock insuficiente para "${item.productoNombre}" (disponible: ${stockRes.value})`)
    }
  }

  // Generar número de venta (YYMMDD-XXXXX)
  const now    = new Date()
  const prefix = `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`
  const seq    = String(Date.now()).slice(-5)
  const saleNumber = `${prefix}-${seq}`

  const saleRepo = new SupabaseSaleRepository()
  const result = await saleRepo.create({
    tiendaId:       auth.tiendaId,
    cashSessionId:  parsed.data.cashSessionId,
    saleNumber,
    cashierId:      auth.userId,
    clienteId:      parsed.data.clienteId,
    items:          parsed.data.items,
    payments:       parsed.data.payments,
    subtotal:       parsed.data.subtotal,
    discountTotal:  parsed.data.discountTotal,
    taxTotal:       parsed.data.taxTotal,
    total:          parsed.data.total,
    change:         parsed.data.change,
    idempotencyKey: parsed.data.idempotencyKey,
  })

  if (!result.ok) return FAIL(result.error.message)

  revalidatePath('/pos')
  revalidatePath('/inventario')
  return OK(result.value.id, saleNumber, 'Venta completada')
}

// ── Anular venta ───────────────────────────────────────────────────────────────

export async function voidSaleAction(
  _prev: SaleActionState,
  formData: FormData,
): Promise<SaleActionState> {
  const auth = await getAuthContext()
  if (!auth) return FAIL('No autenticado')
  if (auth.rol !== 'admin') return FAIL('Solo el admin puede anular ventas')

  const parsed = voidSaleSchema.safeParse({
    saleId:       formData.get('saleId'),
    voidedReason: formData.get('voidedReason'),
  })
  if (!parsed.success) return FAIL(parsed.error.errors[0]?.message ?? 'Datos inválidos')

  const repo   = new SupabaseSaleRepository()
  const result = await repo.void({
    saleId:      parsed.data.saleId,
    tiendaId:    auth.tiendaId,
    voidedBy:    auth.userId,
    voidedReason: parsed.data.voidedReason,
  })

  if (!result.ok) return FAIL(result.error.message)

  revalidatePath('/pos')
  revalidatePath('/inventario')
  return { status: 'success', message: 'Venta anulada', error: null, saleId: result.value.id }
}
