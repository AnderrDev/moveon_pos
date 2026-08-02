import type { CreateExpenseDto } from '@angular-app/features/expenses/domain/dtos/expense.dto'
import type { Empleado } from '@angular-app/features/expenses/domain/entities/expense.entity'
import { buildNominaPagoSugerido } from '@angular-app/features/expenses/domain/services/nomina'
import type { NominaPagoFormValue } from '@angular-app/features/expenses/presentation/forms/nomina-pago-form.factory'

export interface NominaPagoContext {
  tiendaId: string
  /** Categoría con slug `nomina` de la tienda. */
  categoryId: string
  empleado: Pick<Empleado, 'id' | 'nombre' | 'salarioMensual'>
  /** Mes del pago en formato `YYYY-MM`. */
  month: string
}

export const nominaPagoFormMapper = {
  toCreateDto(value: NominaPagoFormValue, ctx: NominaPagoContext): CreateExpenseDto {
    const sugerido = buildNominaPagoSugerido(ctx.empleado, value.tipo, ctx.month)
    return {
      tiendaId: ctx.tiendaId,
      categoryId: ctx.categoryId,
      empleadoId: ctx.empleado.id,
      concepto: sugerido.concepto,
      notas: value.notas?.trim() ? value.notas.trim() : undefined,
      monto: value.monto,
      fechaGasto: value.fechaGasto,
      metodoPago: value.metodoPago,
      periodo: sugerido.periodo,
    }
  },
}
