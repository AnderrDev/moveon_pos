import { describe, expect, it } from 'vitest'
import {
  createEmpleadoFormDefaults,
  empleadoFormSchema,
} from '@angular-app/features/expenses/presentation/forms/empleado-form.factory'
import { empleadoFormMapper } from '@angular-app/features/expenses/presentation/forms/empleado-form.mapper'
import type { Empleado } from '@angular-app/features/expenses/domain/entities/expense.entity'

const tiendaId = '11111111-1111-4111-8111-111111111111'
const now = new Date('2026-07-21T00:00:00.000Z')

const empleado: Empleado = {
  id: 'empleado-1',
  tiendaId,
  nombre: 'Juan Pérez',
  cargo: 'Cajero',
  salarioMensual: 1_800_000,
  isActive: true,
  createdAt: now,
  updatedAt: now,
}

describe('empleadoFormSchema', () => {
  const valid = {
    nombre: 'Juan Pérez',
    cargo: 'Cajero',
    salarioMensual: 1_800_000,
    isActive: true,
  }

  it('acepta un empleado con datos completos', () => {
    expect(empleadoFormSchema.safeParse(valid).success).toBe(true)
  })

  it('acepta cargo vacío (es opcional)', () => {
    expect(empleadoFormSchema.safeParse({ ...valid, cargo: '' }).success).toBe(true)
  })

  it('rechaza nombre demasiado corto o demasiado largo', () => {
    expect(empleadoFormSchema.safeParse({ ...valid, nombre: 'A' }).success).toBe(false)
    expect(empleadoFormSchema.safeParse({ ...valid, nombre: 'x'.repeat(81) }).success).toBe(false)
  })

  it('rechaza cargo de más de 60 caracteres', () => {
    expect(empleadoFormSchema.safeParse({ ...valid, cargo: 'x'.repeat(61) }).success).toBe(false)
  })

  it('rechaza salario cero, negativo o con decimales', () => {
    expect(empleadoFormSchema.safeParse({ ...valid, salarioMensual: 0 }).success).toBe(false)
    expect(empleadoFormSchema.safeParse({ ...valid, salarioMensual: -1 }).success).toBe(false)
    expect(empleadoFormSchema.safeParse({ ...valid, salarioMensual: 1_800_000.5 }).success).toBe(
      false,
    )
  })
})

describe('createEmpleadoFormDefaults', () => {
  it('devuelve valores vacíos con isActive true por defecto', () => {
    expect(createEmpleadoFormDefaults()).toEqual({
      nombre: '',
      cargo: '',
      salarioMensual: 0,
      isActive: true,
    })
  })

  it('permite sobreescribir todos los valores iniciales', () => {
    expect(
      createEmpleadoFormDefaults({
        nombre: 'Ana Gómez',
        cargo: 'Vendedora',
        salarioMensual: 1_500_000,
        isActive: false,
      }),
    ).toEqual({
      nombre: 'Ana Gómez',
      cargo: 'Vendedora',
      salarioMensual: 1_500_000,
      isActive: false,
    })
  })
})

describe('empleadoFormMapper.toFormValue', () => {
  it('convierte el empleado a valores de formulario', () => {
    expect(empleadoFormMapper.toFormValue(empleado)).toEqual({
      nombre: 'Juan Pérez',
      cargo: 'Cajero',
      salarioMensual: 1_800_000,
      isActive: true,
    })
  })

  it('usa cadena vacía cuando el cargo es null', () => {
    expect(empleadoFormMapper.toFormValue({ ...empleado, cargo: null }).cargo).toBe('')
  })

  it('devuelve defaults cuando no hay empleado (modo creación)', () => {
    expect(empleadoFormMapper.toFormValue(null)).toEqual({
      nombre: '',
      cargo: '',
      salarioMensual: 0,
      isActive: true,
    })
    expect(empleadoFormMapper.toFormValue()).toEqual({
      nombre: '',
      cargo: '',
      salarioMensual: 0,
      isActive: true,
    })
  })
})

describe('empleadoFormMapper.toSaveDto', () => {
  const formValue = {
    nombre: '  Juan Pérez  ',
    cargo: '  Cajero  ',
    salarioMensual: 1_800_000,
    isActive: true,
  }

  it('arma el DTO de edición con id y strings limpios', () => {
    expect(
      empleadoFormMapper.toSaveDto(formValue, { tiendaId, empleadoId: empleado.id }),
    ).toEqual({
      id: empleado.id,
      tiendaId,
      nombre: 'Juan Pérez',
      cargo: 'Cajero',
      salarioMensual: 1_800_000,
      isActive: true,
    })
  })

  it('omite id en modo creación y cargo vacío queda undefined', () => {
    const dto = empleadoFormMapper.toSaveDto({ ...formValue, cargo: '   ' }, { tiendaId })
    expect(dto.id).toBeUndefined()
    expect(dto.cargo).toBeUndefined()
  })

  it('trata cargo undefined como ausente', () => {
    const dto = empleadoFormMapper.toSaveDto({ ...formValue, cargo: undefined }, { tiendaId })
    expect(dto.cargo).toBeUndefined()
  })
})
