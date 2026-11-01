import { z } from 'zod'

export const saveFundSettingsSchema = z.object({
  tiendaId: z.string().uuid(),
  saldoInicial: z
    .number()
    .int('El saldo debe ser en pesos, sin decimales')
    .nonnegative('El saldo inicial no puede ser negativo'),
  fechaInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Selecciona la fecha de inicio del fondo'),
  saldoInicialUtilidad: z
    .number()
    .int('El saldo debe ser en pesos, sin decimales')
    .nonnegative('El saldo de utilidad no puede ser negativo')
    .default(0),
  saldoInicialFijos: z
    .number()
    .int('El saldo debe ser en pesos, sin decimales')
    .nonnegative('El saldo para fijos no puede ser negativo')
    .default(0),
  diasInventarioMeta: z
    .number()
    .int('La meta debe ser un número entero de días')
    .min(7, 'La meta mínima es 7 días')
    .max(365, 'La meta máxima es 365 días')
    .default(45),
})

export type SaveFundSettingsDto = z.infer<typeof saveFundSettingsSchema>
