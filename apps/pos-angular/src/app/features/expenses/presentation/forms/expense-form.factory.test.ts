import { describe, expect, it } from 'vitest'
import { createExpenseFormDefaults, expenseFormSchema, todayLocalDate } from '@angular-app/features/expenses/presentation/forms/expense-form.factory'
import { expenseFormMapper } from '@angular-app/features/expenses/presentation/forms/expense-form.mapper'

describe('expenseFormSchema', () => {
  it('valida el valor por defecto solo cuando el usuario completa los campos', () => {
    const vacio = createExpenseFormDefaults()
    expect(expenseFormSchema.safeParse(vacio).success).toBe(false)

    const completo = createExpenseFormDefaults({
      categoryId: '22222222-2222-4222-8222-222222222222',
      concepto: 'Pago de arriendo',
      monto: 1_500_000,
    })
    expect(expenseFormSchema.safeParse(completo).success).toBe(true)
  })
})

describe('todayLocalDate', () => {
  it('formatea la fecha local como YYYY-MM-DD', () => {
    expect(todayLocalDate(new Date(2026, 6, 4, 23, 30))).toBe('2026-07-04')
    expect(todayLocalDate(new Date(2026, 0, 9))).toBe('2026-01-09')
  })
})

describe('expenseFormMapper.toCreateDto', () => {
  const FORM_VALUE = {
    categoryId: '22222222-2222-4222-8222-222222222222',
    concepto: '  Cambio de empaque licuadora  ',
    monto: 45_000,
    fechaGasto: '2026-07-04',
    metodoPago: 'efectivo_caja',
    notas: '  ',
  } as const

  it('arma el DTO con tiendaId del contexto y limpia strings', () => {
    const dto = expenseFormMapper.toCreateDto(FORM_VALUE, { tiendaId: 'tienda-1' })
    expect(dto.tiendaId).toBe('tienda-1')
    expect(dto.concepto).toBe('Cambio de empaque licuadora')
    expect(dto.notas).toBeUndefined()
    expect(dto.empleadoId).toBeUndefined()
    expect(dto.periodo).toBeUndefined()
  })

  it('propaga empleado y período cuando el contexto es de nómina', () => {
    const dto = expenseFormMapper.toCreateDto(FORM_VALUE, {
      tiendaId: 'tienda-1',
      empleadoId: 'emp-1',
      periodo: '2026-07-Q1',
    })
    expect(dto.empleadoId).toBe('emp-1')
    expect(dto.periodo).toBe('2026-07-Q1')
  })
})
