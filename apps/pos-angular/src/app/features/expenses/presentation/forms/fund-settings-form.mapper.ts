import type { SaveFundSettingsDto } from '@angular-app/features/expenses/domain/dtos/fund-settings.dto'
import type { FundSettingsFormValue } from '@angular-app/features/expenses/presentation/forms/fund-settings-form.factory'

export interface FundSettingsFormContext {
  tiendaId: string
}

export const fundSettingsFormMapper = {
  toSaveDto(value: FundSettingsFormValue, ctx: FundSettingsFormContext): SaveFundSettingsDto {
    return {
      tiendaId: ctx.tiendaId,
      saldoInicial: value.saldoInicial,
      fechaInicio: value.fechaInicio,
    }
  },
}
