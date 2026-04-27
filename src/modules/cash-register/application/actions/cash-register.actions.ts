'use server'

import { revalidatePath } from 'next/cache'
import { getAuthContext } from '@/shared/lib/auth-context'
import { SupabaseCashRegisterRepository } from '../../infrastructure/repositories/supabase-cash-register.repository'
import { openSessionSchema, addMovementSchema, closeSessionSchema } from '../dtos/cash-register.dto'

export type CashActionState = {
  status?: 'idle' | 'success' | 'error'
  message?: string
  error: string | null
}
const OK = (message: string): CashActionState => ({ status: 'success', message, error: null })
const FAIL = (error: string): CashActionState => ({ status: 'error', error })

// ── Abrir caja ─────────────────────────────────────────────────────────────────

export async function openSessionAction(
  _prev: CashActionState,
  formData: FormData,
): Promise<CashActionState> {
  const auth = await getAuthContext()
  if (!auth) return FAIL('No autenticado')

  const parsed = openSessionSchema.safeParse({
    openingAmount: Number(formData.get('openingAmount')),
  })
  if (!parsed.success) return FAIL(parsed.error.errors[0]?.message ?? 'Datos inválidos')

  const repo = new SupabaseCashRegisterRepository()

  // Verificar que no haya sesión abierta
  const existing = await repo.getOpenSession(auth.tiendaId)
  if (!existing.ok) return FAIL(existing.error.message)
  if (existing.value) return FAIL('Ya hay una caja abierta en este momento')

  const result = await repo.openSession({
    tiendaId:      auth.tiendaId,
    openedBy:      auth.userId,
    openingAmount: parsed.data.openingAmount,
  })

  if (!result.ok) return FAIL(result.error.message)

  revalidatePath('/caja')
  return OK('Caja abierta correctamente')
}

// ── Registrar movimiento ───────────────────────────────────────────────────────

export async function addCashMovementAction(
  sessionId: string,
  _prev: CashActionState,
  formData: FormData,
): Promise<CashActionState> {
  const auth = await getAuthContext()
  if (!auth) return FAIL('No autenticado')

  const parsed = addMovementSchema.safeParse({
    tipo:   formData.get('tipo'),
    amount: Number(formData.get('amount')),
    motivo: formData.get('motivo'),
  })
  if (!parsed.success) return FAIL(parsed.error.errors[0]?.message ?? 'Datos inválidos')

  const repo = new SupabaseCashRegisterRepository()
  const result = await repo.addMovement({
    cashSessionId: sessionId,
    tipo:          parsed.data.tipo,
    amount:        parsed.data.amount,
    motivo:        parsed.data.motivo,
    createdBy:     auth.userId,
  })

  if (!result.ok) return FAIL(result.error.message)

  revalidatePath('/caja')
  return OK('Movimiento registrado')
}

// ── Cerrar caja ────────────────────────────────────────────────────────────────

export async function closeSessionAction(
  sessionId: string,
  _prev: CashActionState,
  formData: FormData,
): Promise<CashActionState> {
  const auth = await getAuthContext()
  if (!auth) return FAIL('No autenticado')

  const parsed = closeSessionSchema.safeParse({
    actualCashAmount: Number(formData.get('actualCashAmount')),
    notasCierre:      (formData.get('notasCierre') as string) || undefined,
  })
  if (!parsed.success) return FAIL(parsed.error.errors[0]?.message ?? 'Datos inválidos')

  const repo = new SupabaseCashRegisterRepository()
  const result = await repo.closeSession({
    sessionId,
    tiendaId:         auth.tiendaId,
    closedBy:         auth.userId,
    actualCashAmount: parsed.data.actualCashAmount,
    notasCierre:      parsed.data.notasCierre,
  })

  if (!result.ok) return FAIL(result.error.message)

  revalidatePath('/caja')
  return OK('Caja cerrada correctamente')
}
