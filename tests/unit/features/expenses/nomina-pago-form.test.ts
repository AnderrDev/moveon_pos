import { describe, expect, it } from 'vitest'
import {
  createNominaPagoFormDefaults,
  nominaPagoFormSchema,
} from '@angular-app/features/expenses/presentation/forms/nomina-pago-form.factory'
import {
  nominaPagoFormMapper,
  type NominaPagoContext,
} from '@angular-app/features/expenses/presentation/forms/nomina-pago-form.mapper'
import { todayLocalDate } from '@angular-app/features/expenses/presentation/forms/expense-form.factory'

describe('nominaPagoFormSchema', () => {
  const valid = {
    tipo: 'mes',
    monto: 1_800_000,
    fechaGasto: '2026-07-21',
    metodoPago: 'transferencia',
    notas: '',
  }

  it('acepta un pago de nómina válido para cada tipo', () => {
    for (const tipo of ['mes', 'quincena1', 'quincena2', 'adelanto']) {
      expect(nominaPagoFormSchema.safeParse({ ...valid, tipo }).success).toBe(true)
    }
  })

  it('rechaza un tipo de pago desconocido', () => {
    expect(nominaPagoFormSchema.safeParse({ ...valid, tipo: 'anual' }).success).toBe(false)
  })

  it('rechaza monto cero, negativo o con decimales', () => {
    expect(nominaPagoFormSchema.safeParse({ ...valid, monto: 0 }).success).toBe(false)
    expect(nominaPagoFormSchema.safeParse({ ...valid, monto: -1 }).success).toBe(false)
    expect(nominaPagoFormSchema.safeParse({ ...valid, monto: 900_000.5 }).success).toBe(false)
  })

  it('rechaza fecha que no sea YYYY-MM-DD', () => {
    expect(nominaPagoFormSchema.safeParse({ ...valid, fechaGasto: '21/07/2026' }).success).toBe(
      false,
    )
    expect(nominaPagoFormSchema.safeParse({ ...valid, fechaGasto: '' }).success).toBe(false)
  })

  it('rechaza método de pago desconocido', () => {
    expect(nominaPagoFormSchema.safeParse({ ...valid, metodoPago: 'cheque' }).success).toBe(false)
  })

  it('acepta notas opcionales y rechaza notas de más de 500 caracteres', () => {
    expect(nominaPagoFormSchema.safeParse({ ...valid, notas: 'Pago puntual' }).success).toBe(true)
    expect(nominaPagoFormSchema.safeParse({ ...valid, notas: 'x'.repeat(501) }).success).toBe(
      false,
    )
  })
})

describe('createNominaPagoFormDefaults', () => {
  it('precarga mes completo por transferencia con la fecha local de hoy', () => {
    const defaults = createNominaPagoFormDefaults()
    expect(defaults.tipo).toBe('mes')
    expect(defaults.monto).toBe(0)
    expect(defaults.fechaGasto).toBe(todayLocalDate())
    expect(defaults.fechaGasto).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(defaults.metodoPago).toBe('transferencia')
    expect(defaults.notas).toBe('')
  })

  it('permite sobreescribir todos los valores iniciales', () => {
    expect(
      createNominaPagoFormDefaults({
        tipo: 'quincena1',
        monto: 900_000,
        fechaGasto: '2026-07-15',
        metodoPago: 'efectivo_caja',
        notas: 'Primera quincena',
      }),
    ).toEqual({
      tipo: 'quincena1',
      monto: 900_000,
      fechaGasto: '2026-07-15',
      metodoPago: 'efectivo_caja',
      notas: 'Primera quincena',
    })
  })
})

describe('nominaPagoFormMapper.toCreateDto', () => {
  const ctx: NominaPagoContext = {
    tiendaId: '11111111-1111-4111-8111-111111111111',
    categoryId: '22222222-2222-4222-8222-222222222222',
    empleado: { id: 'empleado-1', nombre: 'Juan Pérez', salarioMensual: 1_800_000 },
    month: '2026-07',
  }

  const formValue = {
    tipo: 'mes' as const,
    monto: 1_800_000,
    fechaGasto: '2026-07-21',
    metodoPago: 'transferencia' as const,
    notas: '  Pago puntual  ',
  }

  it('arma el DTO de mes completo con concepto y período sugeridos', () => {
    const dto = nominaPagoFormMapper.toCreateDto(formValue, ctx)
    expect(dto.tiendaId).toBe(ctx.tiendaId)
    expect(dto.categoryId).toBe(ctx.categoryId)
    expect(dto.empleadoId).toBe('empleado-1')
    expect(dto.periodo).toBe('2026-07')
    expect(dto.concepto).toContain('Nómina')
    expect(dto.concepto).toContain('Juan Pérez')
    expect(dto.monto).toBe(1_800_000)
    expect(dto.fechaGasto).toBe('2026-07-21')
    expect(dto.metodoPago).toBe('transferencia')
    expect(dto.notas).toBe('Pago puntual')
  })

  it('usa período de quincena cuando el tipo es quincenal', () => {
    expect(nominaPagoFormMapper.toCreateDto({ ...formValue, tipo: 'quincena1' }, ctx).periodo).toBe(
      '2026-07-Q1',
    )
    expect(nominaPagoFormMapper.toCreateDto({ ...formValue, tipo: 'quincena2' }, ctx).periodo).toBe(
      '2026-07-Q2',
    )
  })

  it('marca adelantos con el concepto de adelanto y el mes como período', () => {
    const dto = nominaPagoFormMapper.toCreateDto({ ...formValue, tipo: 'adelanto' }, ctx)
    expect(dto.periodo).toBe('2026-07')
    expect(dto.concepto).toContain('Adelanto de nómina')
  })

  it('descarta notas en blanco o ausentes', () => {
    expect(nominaPagoFormMapper.toCreateDto({ ...formValue, notas: '   ' }, ctx).notas).toBeUndefined()
    expect(
      nominaPagoFormMapper.toCreateDto({ ...formValue, notas: undefined }, ctx).notas,
    ).toBeUndefined()
  })
})
