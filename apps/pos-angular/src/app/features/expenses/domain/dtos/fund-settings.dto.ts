import { z } from 'zod'

export const saveFundSettingsSchema = z.object({
  tiendaId: z.string().uuid(),
  saldoInicial: z
    .number()
    .int('El saldo debe ser en pesos, sin decimales')
    .nonnegative('El saldo inicial no puede ser negativo'),
  fechaInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Selecciona la fecha de inicio del fondo'),
})

export type SaveFundSettingsDto = z.infer<typeof saveFundSettingsSchema>
