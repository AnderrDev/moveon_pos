import { describe, expect, it } from 'vitest'
import {
  createLoyaltySettingsFormDefaults,
  loyaltySettingsFormSchema,
} from '@/modules/settings/forms/loyalty-settings-form.factory'
import { loyaltySettingsFormMapper } from '@/modules/settings/forms/loyalty-settings-form.mapper'
import { DEFAULT_LOYALTY_CONFIG } from '@/modules/loyalty/domain/loyalty-config'

describe('loyaltySettingsFormSchema', () => {
  const valid = {
    activo: true,
    sellosParaRecompensa: 8,
    valorRecompensaCop: 11_000,
    vigenciaDias: 30,
  }

  it('acepta la configuración por defecto del programa', () => {
    expect(loyaltySettingsFormSchema.safeParse(valid).success).toBe(true)
  })

  it('rechaza sellos fuera de 1..50', () => {
    expect(loyaltySettingsFormSchema.safeParse({ ...valid, sellosParaRecompensa: 0 }).success).toBe(
      false,
    )
    expect(
      loyaltySettingsFormSchema.safeParse({ ...valid, sellosParaRecompensa: 51 }).success,
    ).toBe(false)
  })

  it('rechaza sellos decimales', () => {
    expect(
      loyaltySettingsFormSchema.safeParse({ ...valid, sellosParaRecompensa: 7.5 }).success,
    ).toBe(false)
  })

  it('rechaza valor de recompensa negativo o mayor a $10M', () => {
    expect(
      loyaltySettingsFormSchema.safeParse({ ...valid, valorRecompensaCop: -1 }).success,
    ).toBe(false)
    expect(
      loyaltySettingsFormSchema.safeParse({ ...valid, valorRecompensaCop: 10_000_001 }).success,
    ).toBe(false)
  })

  it('rechaza vigencia fuera de 1..365 días', () => {
    expect(loyaltySettingsFormSchema.safeParse({ ...valid, vigenciaDias: 0 }).success).toBe(false)
    expect(loyaltySettingsFormSchema.safeParse({ ...valid, vigenciaDias: 366 }).success).toBe(
      false,
    )
  })
})

describe('createLoyaltySettingsFormDefaults', () => {
  it('usa los defaults del programa (8 / $11.000 / 30 días)', () => {
    expect(createLoyaltySettingsFormDefaults()).toEqual(DEFAULT_LOYALTY_CONFIG)
  })

  it('permite sobreescribir valores iniciales', () => {
    const defaults = createLoyaltySettingsFormDefaults({ sellosParaRecompensa: 10 })
    expect(defaults.sellosParaRecompensa).toBe(10)
    expect(defaults.vigenciaDias).toBe(DEFAULT_LOYALTY_CONFIG.vigenciaDias)
  })
})

describe('loyaltySettingsFormMapper', () => {
  it('round-trip config → form → payload sin pérdida', () => {
    const config = {
      activo: false,
      sellosParaRecompensa: 10,
      valorRecompensaCop: 12_500,
      vigenciaDias: 45,
    }
    const formValue = loyaltySettingsFormMapper.toFormValue(config)
    expect(loyaltySettingsFormMapper.toPayload(formValue)).toEqual(config)
  })
})
