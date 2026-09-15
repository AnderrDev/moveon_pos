import { z } from 'zod'

export const closeSessionFormSchema = z.object({
  actualCashAmount: z.number().nonnegative('El conteo de efectivo no puede ser negativo'),
  actualTransferAmount: z
    .number()
    .nonnegative('El total de transferencias no puede ser negativo'),
  withdrawAtClose: z.boolean(),
  cashLeftAmount: z.number().nonnegative('El efectivo dejado no puede ser negativo'),
  notasCierre: z.string().max(500, 'Las notas no pueden superar 500 caracteres'),
}).refine(
  (value) => !value.withdrawAtClose || value.cashLeftAmount <= value.actualCashAmount,
  {
    path: ['cashLeftAmount'],
    message: 'El efectivo dejado no puede superar el efectivo contado',
  },
)

export type CloseSessionFormValue = z.infer<typeof closeSessionFormSchema>

export function createCloseSessionDefaults(
  initial: Partial<CloseSessionFormValue> = {},
): CloseSessionFormValue {
  return {
    actualCashAmount: initial.actualCashAmount ?? 0,
    actualTransferAmount: initial.actualTransferAmount ?? 0,
    withdrawAtClose: initial.withdrawAtClose ?? false,
    cashLeftAmount: initial.cashLeftAmount ?? 0,
    notasCierre: initial.notasCierre ?? '',
  }
}
