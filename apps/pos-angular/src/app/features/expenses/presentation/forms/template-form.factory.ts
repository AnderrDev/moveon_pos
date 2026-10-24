import type { z } from 'zod'
import { saveTemplateSchema } from '@angular-app/features/expenses/domain/dtos/template.dto'

/** Plantilla de gasto recurrente: reglas del DTO sin id ni tienda (los aporta el diálogo). */
export const templateFormSchema = saveTemplateSchema.omit({ id: true, tiendaId: true })

export type TemplateFormValue = z.infer<typeof templateFormSchema>

export function createTemplateFormDefaults(initial: Partial<TemplateFormValue> = {}): TemplateFormValue {
  return {
    categoryId: initial.categoryId ?? '',
    concepto: initial.concepto ?? '',
    montoSugerido: initial.montoSugerido ?? 0,
    frecuencia: initial.frecuencia ?? 'mensual',
  }
}
