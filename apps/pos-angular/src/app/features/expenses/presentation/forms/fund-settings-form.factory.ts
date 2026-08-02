import { z } from 'zod'
import { saveFundSettingsSchema } from '@angular-app/features/expenses/domain/dtos/fund-settings.dto'
import { todayLocalDate } from '@angular-app/features/expenses/presentation/forms/expense-form.factory'

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
