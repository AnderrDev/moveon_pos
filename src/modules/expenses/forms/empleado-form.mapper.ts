import type { SaveEmpleadoDto } from '../application/dtos/empleado.dto'
import type { Empleado } from '../domain/entities/expense.entity'
import type { EmpleadoFormValue } from './empleado-form.factory'

export const empleadoFormMapper = {
  toFormValue(empleado?: Empleado | null): EmpleadoFormValue {
    return {
      nombre: empleado?.nombre ?? '',
      cargo: empleado?.cargo ?? '',
      salarioMensual: empleado?.salarioMensual ?? 0,
      isActive: empleado?.isActive ?? true,
    }
  },

  toSaveDto(
    value: EmpleadoFormValue,
    ctx: { tiendaId: string; empleadoId?: string },
  ): SaveEmpleadoDto {
    return {
      id: ctx.empleadoId,
      tiendaId: ctx.tiendaId,
      nombre: value.nombre.trim(),
      cargo: value.cargo?.trim() ? value.cargo.trim() : undefined,
      salarioMensual: value.salarioMensual,
      isActive: value.isActive,
    }
  },
}
