import { describe, expect, it } from 'vitest'
import { saveFundSettingsSchema } from './fund-settings.dto'

const VALID_SETTINGS = {
  tiendaId: '11111111-1111-4111-8111-111111111111',
  saldoInicial: 500_000,
  fechaInicio: '2026-07-08',
} as const

describe('saveFundSettingsSchema', () => {
  it('acepta una configuración válida del fondo', () => {
    expect(saveFundSettingsSchema.safeParse(VALID_SETTINGS).success).toBe(true)
  })

  it('permite saldo inicial en cero', () => {
    expect(saveFundSettingsSchema.safeParse({ ...VALID_SETTINGS, saldoInicial: 0 }).success).toBe(
      true,
    )
  })

  it('rechaza saldo negativo, decimal o fecha mal formada', () => {
    expect(saveFundSettingsSchema.safeParse({ ...VALID_SETTINGS, saldoInicial: -1 }).success).toBe(
      false,
    )
    expect(
      saveFundSettingsSchema.safeParse({ ...VALID_SETTINGS, saldoInicial: 1000.5 }).success,
    ).toBe(false)
    expect(
      saveFundSettingsSchema.safeParse({ ...VALID_SETTINGS, fechaInicio: '08/07/2026' }).success,
    ).toBe(false)
  })
})
