import { z } from 'zod'
import { saveFundSettingsSchema } from '../application/dtos/fund-settings.dto'
import { todayLocalDate } from './expense-form.factory'

export const fundSettingsFormSchema = saveFundSettingsSchema.omit({ tiendaId: true })

export type FundSettingsFormValue = z.infer<typeof fundSettingsFormSchema>

export function createFundSettingsFormDefaults(
  initial: Partial<FundSettingsFormValue> = {},
): FundSettingsFormValue {
  return {
    saldoInicial: initial.saldoInicial ?? 0,
    fechaInicio: initial.fechaInicio ?? todayLocalDate(),
  }
}
