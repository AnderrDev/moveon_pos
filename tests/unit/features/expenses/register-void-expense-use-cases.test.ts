import { describe, expect, it } from 'vitest'
import { registerExpense } from '@angular-app/features/expenses/domain/usecases/register-expense.use-case'
import { voidExpense } from '@angular-app/features/expenses/domain/usecases/void-expense.use-case'
import type { Expense } from '@angular-app/features/expenses/domain/entities/expense.entity'
import type { CreateExpenseDto, VoidExpenseDto } from '@angular-app/features/expenses/domain/dtos/expense.dto'

const tiendaId = '11111111-1111-4111-8111-111111111111'
const categoryId = '22222222-2222-4222-8222-222222222222'
const expenseId = '33333333-3333-4333-8333-333333333333'
const userId = 'user-1'
const now = new Date('2026-07-21T00:00:00.000Z')

const expense: Expense = {
  id: expenseId,
  tiendaId,
  categoryId,
  empleadoId: null,
  concepto: 'Pago de arriendo',
  notas: null,
  monto: 900_000,
  fechaGasto: '2026-07-21',
  metodoPago: 'transferencia',
  cashMovementId: null,
  periodo: null,
  status: 'active',
  voidedReason: null,
  voidedAt: null,
  createdBy: userId,
  createdAt: now,
}

describe('registerExpense', () => {
  const validInput = {
    tiendaId,
    categoryId,
    concepto: 'Pago de arriendo',
    monto: 900_000,
    fechaGasto: '2026-07-21',
    metodoPago: 'transferencia',
  }

  it('registra el gasto cuando los datos son válidos y pasa el userId al repositorio', async () => {
    let received: { dto: CreateExpenseDto; userId: string } | null = null
    const repo = {
      createExpense: async (dto: CreateExpenseDto, uid: string) => {
        received = { dto, userId: uid }
        return expense
      },
    }
    const result = await registerExpense({ repo, userId }, validInput)
    expect(result).toEqual({ ok: true, value: expense })
    expect(received).toEqual({ dto: validInput, userId })
  })

  it('rechaza monto no positivo con error de validación sin llamar al repositorio', async () => {
    let called = false
    const repo = { createExpense: async () => { called = true; return expense } }
    const result = await registerExpense({ repo, userId }, { ...validInput, monto: 0 })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('validation')
    expect(called).toBe(false)
  })

  it('rechaza concepto demasiado corto y fecha mal formada', async () => {
    const repo = { createExpense: async () => expense }
    const corto = await registerExpense({ repo, userId }, { ...validInput, concepto: 'ab' })
    const fecha = await registerExpense({ repo, userId }, { ...validInput, fechaGasto: '21-07-2026' })
    expect(corto.ok).toBe(false)
    expect(fecha.ok).toBe(false)
  })

  it('propaga como throw los fallos técnicos del repositorio', async () => {
    const repo = {
      createExpense: async () => {
        throw new Error('DB caída')
      },
    }
    await expect(registerExpense({ repo, userId }, validInput)).rejects.toThrow('DB caída')
  })
})

describe('voidExpense', () => {
  const validInput = {
    expenseId,
    tiendaId,
    motivo: 'Registrado por error de digitación',
  }

  const voided: Expense = {
    ...expense,
    status: 'voided',
    voidedReason: validInput.motivo,
    voidedAt: now,
  }

  it('anula el gasto cuando los datos son válidos y pasa el userId al repositorio', async () => {
    let received: { dto: VoidExpenseDto; userId: string } | null = null
    const repo = {
      voidExpense: async (dto: VoidExpenseDto, uid: string) => {
        received = { dto, userId: uid }
        return voided
      },
    }
    const result = await voidExpense({ repo, userId }, validInput)
    expect(result).toEqual({ ok: true, value: voided })
    expect(received).toEqual({ dto: validInput, userId })
  })

  it('rechaza motivo de menos de 10 caracteres con error de validación sin llamar al repositorio', async () => {
    let called = false
    const repo = { voidExpense: async () => { called = true; return voided } }
    const result = await voidExpense({ repo, userId }, { ...validInput, motivo: 'error' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('validation')
    expect(called).toBe(false)
  })

  it('rechaza ids que no sean UUID', async () => {
    const repo = { voidExpense: async () => voided }
    const result = await voidExpense({ repo, userId }, { ...validInput, expenseId: 'gasto-1' })
    expect(result.ok).toBe(false)
  })

  it('propaga como throw los fallos técnicos del repositorio', async () => {
    const repo = {
      voidExpense: async () => {
        throw new Error('DB caída')
      },
    }
    await expect(voidExpense({ repo, userId }, validInput)).rejects.toThrow('DB caída')
  })
})
