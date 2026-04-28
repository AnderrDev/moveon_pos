'use server'

import { revalidatePath } from 'next/cache'
import { getAuthContext } from '@/shared/lib/auth-context'
import { SupabaseSaleRepository } from '../../infrastructure/repositories/supabase-sale.repository'
import { SupabaseCashRegisterRepository } from '@/modules/cash-register/infrastructure/repositories/supabase-cash-register.repository'
import { SupabaseInventoryRepository } from '@/modules/inventory/infrastructure/repositories/supabase-inventory.repository'
import { SupabaseProductRepository } from '@/modules/products/infrastructure/repositories/supabase-product.repository'
import { createSaleUseCase } from '../use-cases/create-sale.use-case'
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

  const result = await createSaleUseCase({
    ...parsed.data,
    tiendaId:       auth.tiendaId,
    cashierId:      auth.userId,
    cashierRole:    auth.rol,
  }, {
    cashRepository:      new SupabaseCashRegisterRepository(),
    inventoryRepository: new SupabaseInventoryRepository(),
    productRepository:   new SupabaseProductRepository(),
    saleRepository:      new SupabaseSaleRepository(),
  })

  if (!result.ok) return FAIL(result.error.message)

  revalidatePath('/pos')
  revalidatePath('/inventario')
  return OK(result.value.id, result.value.saleNumber, 'Venta completada')
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
