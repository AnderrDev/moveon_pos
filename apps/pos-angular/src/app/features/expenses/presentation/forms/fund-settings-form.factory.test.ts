import { describe, expect, it } from 'vitest'
import { createFundSettingsFormDefaults, fundSettingsFormSchema } from '@angular-app/features/expenses/presentation/forms/fund-settings-form.factory'
import { fundSettingsFormMapper } from '@angular-app/features/expenses/presentation/forms/fund-settings-form.mapper'

describe('fundSettingsFormSchema', () => {
  it('valida los defaults del formulario', () => {
    const defaults = createFundSettingsFormDefaults({
      saldoInicial: 250_000,
      fechaInicio: '2026-07-08',
    })

    expect(fundSettingsFormSchema.safeParse(defaults).success).toBe(true)
  })
})

describe('fundSettingsFormMapper.toSaveDto', () => {
  it('agrega tiendaId desde el contexto', () => {
    const dto = fundSettingsFormMapper.toSaveDto(
      { saldoInicial: 250_000, fechaInicio: '2026-07-08' },
      { tiendaId: '11111111-1111-4111-8111-111111111111' },
    )

    expect(dto).toEqual({
      tiendaId: '11111111-1111-4111-8111-111111111111',
      saldoInicial: 250_000,
      fechaInicio: '2026-07-08',
    })
  })
})
