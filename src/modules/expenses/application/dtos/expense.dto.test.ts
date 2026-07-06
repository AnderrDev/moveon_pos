import { describe, expect, it } from 'vitest'
import {
  createExpenseSchema,
  voidExpenseSchema,
  VOID_EXPENSE_REASON_MIN_LENGTH,
} from './expense.dto'

const VALID_EXPENSE = {
  tiendaId: '11111111-1111-4111-8111-111111111111',
  categoryId: '22222222-2222-4222-8222-222222222222',
  concepto: 'Arreglo de la licuadora',
  monto: 80_000,
  fechaGasto: '2026-07-04',
  metodoPago: 'efectivo_externo',
} as const

describe('createExpenseSchema', () => {
  it('acepta un gasto válido', () => {
    const parsed = createExpenseSchema.safeParse(VALID_EXPENSE)
    expect(parsed.success).toBe(true)
  })

  it('acepta período mensual y quincenal', () => {
    expect(createExpenseSchema.safeParse({ ...VALID_EXPENSE, periodo: '2026-07' }).success).toBe(true)
    expect(createExpenseSchema.safeParse({ ...VALID_EXPENSE, periodo: '2026-07-Q1' }).success).toBe(true)
    expect(createExpenseSchema.safeParse({ ...VALID_EXPENSE, periodo: 'julio' }).success).toBe(false)
  })

  it('rechaza monto cero, negativo o con decimales', () => {
    expect(createExpenseSchema.safeParse({ ...VALID_EXPENSE, monto: 0 }).success).toBe(false)
    expect(createExpenseSchema.safeParse({ ...VALID_EXPENSE, monto: -1000 }).success).toBe(false)
    expect(createExpenseSchema.safeParse({ ...VALID_EXPENSE, monto: 1000.5 }).success).toBe(false)
  })

  it('rechaza concepto demasiado corto y fecha mal formada', () => {
    expect(createExpenseSchema.safeParse({ ...VALID_EXPENSE, concepto: 'ab' }).success).toBe(false)
    expect(createExpenseSchema.safeParse({ ...VALID_EXPENSE, fechaGasto: '04/07/2026' }).success).toBe(false)
  })

  it('rechaza métodos de pago fuera del catálogo', () => {
    expect(createExpenseSchema.safeParse({ ...VALID_EXPENSE, metodoPago: 'cheque' }).success).toBe(false)
  })
})

describe('voidExpenseSchema', () => {
  const VALID_VOID = {
    expenseId: '33333333-3333-4333-8333-333333333333',
    tiendaId: '11111111-1111-4111-8111-111111111111',
    motivo: 'Se registró dos veces el mismo gasto',
  }

  it('acepta una anulación válida', () => {
    expect(voidExpenseSchema.safeParse(VALID_VOID).success).toBe(true)
  })

  it('exige motivo con longitud mínima', () => {
    const corto = 'x'.repeat(VOID_EXPENSE_REASON_MIN_LENGTH - 1)
    expect(voidExpenseSchema.safeParse({ ...VALID_VOID, motivo: corto }).success).toBe(false)
  })
})
