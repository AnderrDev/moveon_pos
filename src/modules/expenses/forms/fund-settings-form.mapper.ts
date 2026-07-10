import type { SaveFundSettingsDto } from '../application/dtos/fund-settings.dto'
import type { FundSettingsFormValue } from './fund-settings-form.factory'

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
