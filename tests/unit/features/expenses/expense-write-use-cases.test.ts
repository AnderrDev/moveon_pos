import { describe, expect, it } from 'vitest'
import { saveEmpleado } from '@angular-app/features/expenses/domain/usecases/save-empleado.use-case'
import { saveTemplate } from '@angular-app/features/expenses/domain/usecases/save-template.use-case'
import { deleteTemplate } from '@angular-app/features/expenses/domain/usecases/delete-template.use-case'
import { saveFundSettings } from '@angular-app/features/expenses/domain/usecases/save-fund-settings.use-case'
import type {
  Empleado,
  ExpenseTemplate,
  ReinvestmentFundSettings,
} from '@angular-app/features/expenses/domain/entities/expense.entity'

const tiendaId = '11111111-1111-4111-8111-111111111111'
const now = new Date('2026-07-17T00:00:00.000Z')

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

const template: ExpenseTemplate = {
  id: 'template-1',
  tiendaId,
  categoryId: '22222222-2222-4222-8222-222222222222',
  empleadoId: null,
  concepto: 'Arriendo local',
  montoSugerido: 900_000,
  frecuencia: 'mensual',
  isActive: true,
}

const fundSettings: ReinvestmentFundSettings = {
  tiendaId,
  saldoInicial: 500_000,
  fechaInicio: '2026-01-01',
  updatedAt: now,
}

describe('saveEmpleado', () => {
  const validInput = { tiendaId, nombre: 'Juan Pérez', salarioMensual: 1_800_000 }

  it('crea el empleado cuando los datos son válidos', async () => {
    const repo = { saveEmpleado: async () => empleado }
    const result = await saveEmpleado({ repo }, validInput)
    expect(result).toEqual({ ok: true, value: empleado })
  })

  it('rechaza nombre demasiado corto sin llamar al repositorio', async () => {
    let called = false
    const repo = { saveEmpleado: async () => { called = true; return empleado } }
    const result = await saveEmpleado({ repo }, { ...validInput, nombre: 'A' })
    expect(result.ok).toBe(false)
    expect(called).toBe(false)
  })

  it('rechaza salario negativo sin llamar al repositorio', async () => {
    let called = false
    const repo = { saveEmpleado: async () => { called = true; return empleado } }
    const result = await saveEmpleado({ repo }, { ...validInput, salarioMensual: -1 })
    expect(result.ok).toBe(false)
    expect(called).toBe(false)
  })
})

describe('saveTemplate', () => {
  const validInput = {
    tiendaId,
    categoryId: template.categoryId,
    concepto: 'Arriendo local',
    montoSugerido: 900_000,
    frecuencia: 'mensual' as const,
  }

  it('crea la plantilla cuando los datos son válidos', async () => {
    const repo = { saveTemplate: async () => template }
    const result = await saveTemplate({ repo }, validInput)
    expect(result).toEqual({ ok: true, value: template })
  })

  it('rechaza monto sugerido no positivo sin llamar al repositorio', async () => {
    let called = false
    const repo = { saveTemplate: async () => { called = true; return template } }
    const result = await saveTemplate({ repo }, { ...validInput, montoSugerido: 0 })
    expect(result.ok).toBe(false)
    expect(called).toBe(false)
  })
})

describe('deleteTemplate', () => {
  it('delega en el repositorio con los ids correctos', async () => {
    let received: [string, string] | null = null
    const repo = {
      deleteTemplate: async (id: string, tid: string) => {
        received = [id, tid]
      },
    }
    await deleteTemplate({ repo }, template.id, tiendaId)
    expect(received).toEqual([template.id, tiendaId])
  })
})

describe('saveFundSettings', () => {
  const validInput = { tiendaId, saldoInicial: 500_000, fechaInicio: '2026-01-01' }

  it('guarda la configuración cuando los datos son válidos', async () => {
    const repo = { saveFundSettings: async () => fundSettings }
    const result = await saveFundSettings({ repo }, validInput)
    expect(result).toEqual({ ok: true, value: fundSettings })
  })

  it('rechaza saldo inicial negativo sin llamar al repositorio', async () => {
    let called = false
    const repo = { saveFundSettings: async () => { called = true; return fundSettings } }
    const result = await saveFundSettings({ repo }, { ...validInput, saldoInicial: -1 })
    expect(result.ok).toBe(false)
    expect(called).toBe(false)
  })
})
