import { z } from 'zod'

export type DiscountMode = 'amount' | 'percent'

/** Descuento por unidad en pesos, a partir del modo elegido. */
export function discountPerUnit(
  value: { discountMode: DiscountMode; discountAmount: number; discountPercent: number },
  unitPrice: number,
): number {
  return value.discountMode === 'percent'
    ? Math.round((unitPrice * value.discountPercent) / 100)
    : value.discountAmount
}

/**
 * Descuento por producto del POS. El tope depende del precio unitario del
 * ítem, por eso el schema se arma con él.
 */
export function createItemDiscountFormSchema(unitPrice: number) {
  return z
    .object({
      discountMode: z.enum(['amount', 'percent']),
      discountAmount: z.number().nonnegative('El descuento no puede ser negativo'),
      discountPercent: z
        .number()
        .nonnegative('El descuento no puede ser negativo')
        .max(100, 'El porcentaje no puede superar 100'),
    })
    .superRefine((value, ctx) => {
      if (discountPerUnit(value, unitPrice) > unitPrice) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [value.discountMode === 'percent' ? 'discountPercent' : 'discountAmount'],
          message: 'El descuento no puede superar el precio unitario',
        })
      }
    })
}

export type ItemDiscountFormValue = z.infer<ReturnType<typeof createItemDiscountFormSchema>>

export function createItemDiscountDefaults(initial: Partial<ItemDiscountFormValue> = {}): ItemDiscountFormValue {
  return {
    discountMode: initial.discountMode ?? 'amount',
    discountAmount: initial.discountAmount ?? 0,
    discountPercent: initial.discountPercent ?? 0,
  }
}
