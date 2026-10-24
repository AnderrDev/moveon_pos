import '@angular/compiler'
import { Injector } from '@angular/core'
import { describe, expect, it } from 'vitest'
import {
  createTemplateFormDefaults,
  templateFormSchema,
} from '@angular-app/features/expenses/presentation/forms/template-form.factory'
import { templateFormMapper } from '@angular-app/features/expenses/presentation/forms/template-form.mapper'
import { AdjustStampsFormPresenter } from '@angular-app/features/loyalty/presentation/presenters/adjust-stamps-form.presenter'

const TIENDA = '11111111-1111-4111-8111-111111111111'
const CATEGORY = '22222222-2222-4222-8222-222222222222'

describe('plantilla de gasto', () => {
  it('arranca vacía y mensual, y exige categoría y monto', () => {
    const defaults = createTemplateFormDefaults()
    expect(defaults).toEqual({ categoryId: '', concepto: '', montoSugerido: 0, frecuencia: 'mensual' })
    const result = templateFormSchema.safeParse(defaults)
    expect(result.success ? [] : result.error.issues.map((i) => i.path[0])).toEqual(
      expect.arrayContaining(['categoryId', 'concepto', 'montoSugerido']),
    )
  })

  it('agrega la tienda al guardar', () => {
    const value = templateFormSchema.parse({ categoryId: CATEGORY, concepto: 'Arriendo', montoSugerido: 900_000, frecuencia: 'mensual' })
    expect(templateFormMapper.toSaveDto(value, { tiendaId: TIENDA })).toEqual({ ...value, tiendaId: TIENDA })
  })
})

describe('AdjustStampsFormPresenter', () => {
  const presenter = () => Injector.create({ providers: [AdjustStampsFormPresenter] }).get(AdjustStampsFormPresenter)

  it('un delta vacío se rechaza en el campo, no se envía como 0', () => {
    const p = presenter()
    p.form.setValue({ delta: null, reason: 'Corrección de tarjeta' })
    expect(p.validate()).toBeNull()
    expect(Object.keys(p.errors())).toEqual(['delta'])
  })

  it('devuelve el ajuste válido y reset deja el formulario limpio', () => {
    const p = presenter()
    p.form.setValue({ delta: -2, reason: 'Sellos mal asignados' })
    expect(p.validate()).toEqual({ delta: -2, reason: 'Sellos mal asignados' })
    p.setRootError('falló')
    p.reset()
    expect(p.form.getRawValue()).toEqual({ delta: null, reason: '' })
    expect(p.errors()).toEqual({})
  })
})
