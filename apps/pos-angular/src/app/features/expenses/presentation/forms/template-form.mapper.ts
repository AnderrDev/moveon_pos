import type { SaveTemplateDto } from '@angular-app/features/expenses/domain/dtos/template.dto'
import type { TemplateFormValue } from './template-form.factory'

export const templateFormMapper = {
  toSaveDto(value: TemplateFormValue, ctx: { tiendaId: string }): SaveTemplateDto {
    return { ...value, tiendaId: ctx.tiendaId }
  },
}
