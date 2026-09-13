import { z } from 'zod'

export const openSessionSchema = z.object({
  openingAmount: z.number().nonnegative('El monto de apertura no puede ser negativo'),
})

export const addMovementSchema = z.object({
  tipo:   z.enum(['cash_in', 'cash_out', 'expense', 'correction']),
  amount: z.number().positive('El monto debe ser mayor a 0'),
  motivo: z.string().min(3, 'Describe el motivo').max(200),
})

/** Mínimo de caracteres del motivo de anulación (mismo umbral que anular ventas). */
export const VOID_MOVEMENT_REASON_MIN_LENGTH = 10

export const voidMovementSchema = z.object({
  movementId: z.string().uuid(),
  reason: z
    .string()
    .trim()
    .min(VOID_MOVEMENT_REASON_MIN_LENGTH, `El motivo debe tener al menos ${VOID_MOVEMENT_REASON_MIN_LENGTH} caracteres`),
})

export const closeSessionSchema = z.object({
  actualCashAmount: z.number().nonnegative('El conteo de efectivo no puede ser negativo'),
  cashLeftAmount: z.number().nonnegative('El efectivo dejado no puede ser negativo'),
  actualCardAmount: z.number().nonnegative('El total de tarjeta no puede ser negativo').default(0),
  actualTransferAmount: z.number().nonnegative('El total de transferencias no puede ser negativo').default(0),
  actualOtherAmount: z.number().nonnegative('El total de otros medios no puede ser negativo').default(0),
  notasCierre:      z.string().max(500).optional(),
}).refine((value) => value.cashLeftAmount <= value.actualCashAmount, {
  path: ['cashLeftAmount'],
  message: 'El efectivo dejado no puede superar el efectivo contado',
})

/**
 * Corrección de un movimiento ya registrado (RN-C16): solo monto y motivo. El
 * `tipo` no se corrige — cambiar un ingreso por un egreso invierte el signo del
 * cuadre, y para eso está la anulación.
 */
export const correctMovementSchema = z.object({
  movementId: z.string().uuid(),
  newAmount: z.number().positive('El monto debe ser mayor a 0'),
  newMotivo: z.string().trim().min(3, 'Describe el motivo').max(200),
  reason: z
    .string()
    .trim()
    .min(
      VOID_MOVEMENT_REASON_MIN_LENGTH,
      `El motivo de la corrección debe tener al menos ${VOID_MOVEMENT_REASON_MIN_LENGTH} caracteres`,
    ),
})

export const correctOpeningSchema = z.object({
  sessionId: z.string().uuid(),
  newAmount: z.number().nonnegative('El monto de apertura no puede ser negativo'),
  reason: z
    .string()
    .trim()
    .min(VOID_MOVEMENT_REASON_MIN_LENGTH, `El motivo debe tener al menos ${VOID_MOVEMENT_REASON_MIN_LENGTH} caracteres`),
})
